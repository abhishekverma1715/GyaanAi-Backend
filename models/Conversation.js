const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role:       { type: String, enum: ['user','assistant','system'], required: true },
  content:    { type: String, required: true, maxlength: 32000 },
  isError:    { type: Boolean, default: false },
  queryType:  { type: String, enum: ['general','weather','news','sports','coding','search','finance','streaming'], default: 'general' },
  sources:    [{ title: String, url: String, snippet: String }],
  metadata:   { type: Map, of: String },
  tokens:     { type: Number, default: 0 },
}, { timestamps: true });

const ConversationSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:    { type: String, trim: true, maxlength: 200, default: 'New Chat' },
  messages: { type: [MessageSchema], default: [] },
  pinned:   { type: Boolean, default: false },
  tags:     [String],
  model:    { type: String, default: 'auto' },
  totalTokens: { type: Number, default: 0 },
}, { timestamps: true });

ConversationSchema.pre('save', function(next) {
  if (this.isModified('messages') && this.messages.length === 1 && this.title === 'New Chat') {
    const t = this.messages[0].content;
    this.title = t.length > 60 ? t.substring(0, 60).trim() + '...' : t.trim();
  }
  next();
});

ConversationSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
