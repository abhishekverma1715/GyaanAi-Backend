const mem = require('../utils/memoryStore');
const { generateResponse, streamResponse } = require('../services/aiService');
const { v4: uuid } = require('uuid');

let ConvModel = null;
try { ConvModel = require('../models/Conversation'); } catch {}

const useDB = () => mem.isDBConnected() && ConvModel;

// GET /api/chat/conversations
exports.getConversations = async (req, res) => {
  try {
    if (useDB()) {
      const convs = await ConvModel.find({ userId: req.user._id }).sort({ updatedAt: -1 }).select('title pinned updatedAt createdAt').limit(100);
      return res.json(convs);
    }
    res.json(mem.findConvsByUser(req.user._id));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/chat/conversations
exports.createConversation = async (req, res) => {
  try {
    const { title = 'New Chat' } = req.body;
    if (useDB()) {
      const c = await ConvModel.create({ userId: req.user._id, title });
      return res.status(201).json(c);
    }
    res.status(201).json(mem.createConversation({ userId: req.user._id, title }));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/chat/conversations/:id
exports.getConversation = async (req, res) => {
  try {
    if (useDB()) {
      const c = await ConvModel.findOne({ _id: req.params.id, userId: req.user._id });
      if (!c) return res.status(404).json({ message: 'Not found' });
      return res.json(c);
    }
    const c = mem.findConvById(req.params.id, req.user._id);
    if (!c) return res.status(404).json({ message: 'Not found' });
    res.json(c);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/chat/conversations/:id
exports.deleteConversation = async (req, res) => {
  try {
    if (useDB()) { await ConvModel.findOneAndDelete({ _id: req.params.id, userId: req.user._id }); }
    else { mem.deleteConv(req.params.id, req.user._id); }
    res.json({ message: 'Deleted', id: req.params.id });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PATCH /api/chat/conversations/:id
exports.updateConversation = async (req, res) => {
  try {
    const { title, pinned } = req.body;
    const updates = { ...(title && { title }), ...(pinned !== undefined && { pinned }) };
    if (useDB()) {
      const c = await ConvModel.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, updates, { new: true });
      return res.json(c);
    }
    res.json(mem.updateConv(req.params.id, req.user._id, updates));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/chat/conversations/:id/messages — Standard response
exports.sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Message content required' });

    let conv, history = [];

    if (useDB()) {
      conv = await ConvModel.findOne({ _id: req.params.id, userId: req.user._id });
      if (!conv) return res.status(404).json({ message: 'Conversation not found' });
      conv.messages.push({ role: 'user', content: content.trim() });
      history = conv.messages.slice(-20).map(m => ({ role: m.role, content: m.content }));
    } else {
      conv = mem.findConvById(req.params.id, req.user._id);
      if (!conv) return res.status(404).json({ message: 'Conversation not found' });
      if (conv.messages.length === 0) conv.title = content.length > 55 ? content.substring(0,55)+'...' : content;
      conv.messages.push({ _id: uuid(), role: 'user', content: content.trim(), createdAt: new Date().toISOString() });
      history = conv.messages.slice(-20).map(m => ({ role: m.role, content: m.content }));
    }

    // Generate AI response with smart routing
    const result = await generateResponse(content, history);

    if (useDB()) {
      conv.messages.push({ role: 'assistant', content: result.text, queryType: result.queryType, sources: result.sources });
      await conv.save();
    } else {
      conv.messages.push({ _id: uuid(), role: 'assistant', content: result.text, queryType: result.queryType, sources: result.sources, createdAt: new Date().toISOString() });
      conv.updatedAt = new Date().toISOString();
    }

    res.json({
      aiResponse: result.text,
      queryType:  result.queryType,
      sources:    result.sources,
      liveData:   result.liveData,
      title:      conv.title,
      conversationId: req.params.id,
    });
  } catch (err) {
    console.error('[sendMessage]', err.message);
    res.status(500).json({ message: 'AI processing failed: ' + err.message });
  }
};

// POST /api/chat/conversations/:id/stream — SSE streaming response
exports.streamMessage = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Content required' });

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let history = [];
    let conv;

    if (useDB()) {
      conv = await ConvModel.findOne({ _id: req.params.id, userId: req.user._id });
      if (!conv) { res.write(`data: ${JSON.stringify({ error: 'Not found' })}\n\n`); return res.end(); }
      conv.messages.push({ role: 'user', content: content.trim() });
      history = conv.messages.slice(-20).map(m => ({ role: m.role, content: m.content }));
    } else {
      conv = mem.findConvById(req.params.id, req.user._id);
      if (!conv) { res.write(`data: ${JSON.stringify({ error: 'Not found' })}\n\n`); return res.end(); }
      if (conv.messages.length === 0) conv.title = content.length > 55 ? content.substring(0,55)+'...' : content;
      conv.messages.push({ _id: uuid(), role: 'user', content: content.trim(), createdAt: new Date().toISOString() });
      history = conv.messages.slice(-20).map(m => ({ role: m.role, content: m.content }));
    }

    const fullText = await streamResponse(content, history, res);

    // Save AI response after streaming completes
    if (useDB()) {
      conv.messages.push({ role: 'assistant', content: fullText });
      await conv.save();
    } else {
      conv.messages.push({ _id: uuid(), role: 'assistant', content: fullText, createdAt: new Date().toISOString() });
      conv.updatedAt = new Date().toISOString();
    }

    res.end();
  } catch (err) {
    console.error('[streamMessage]', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
};

// DELETE /api/chat/conversations/:id/messages
exports.clearMessages = async (req, res) => {
  try {
    if (useDB()) {
      await ConvModel.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { messages: [], title: 'New Chat' });
    } else {
      mem.updateConv(req.params.id, req.user._id, { messages: [], title: 'New Chat' });
    }
    res.json({ message: 'Cleared' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/chat/conversations
exports.deleteAll = async (req, res) => {
  try {
    if (useDB()) { await ConvModel.deleteMany({ userId: req.user._id }); }
    else { mem.deleteAllConvs(req.user._id); }
    res.json({ message: 'All deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
