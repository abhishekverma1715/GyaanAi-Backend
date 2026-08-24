const axios = require('axios');
const { classifyQuery }      = require('../utils/queryClassifier');
const { getWeather, formatWeatherForAI }   = require('./weatherService');
const { getNews, formatNewsForAI }         = require('./newsService');
const { webSearch, formatSearchForAI }     = require('./searchService');

// ── System Prompt ─────────────────────────────────────────────────────────────
const BASE_SYSTEM = `You are GyaanAI — a highly intelligent, fast, and accurate AI assistant created by Abhishek Verma. 

PERSONALITY:
- Smart, concise, and human-like
- Structured responses with clear formatting
- Use markdown: headers (##), bold (**text**), bullet points, code blocks
- Never say you cannot access internet — you receive live data as context
- Always answer confidently using provided live data when available
- For Indian users: understand Hindi queries, respond in English (or Hindi if asked)

FORMATTING RULES:
- Use ## for main sections, ### for sub-sections
- Use **bold** for key terms
- Use bullet points for lists
- Use numbered lists for steps
- Always wrap code in \`\`\`language blocks
- Keep answers focused and scannable

RESPONSE STYLE:
- Lead with the direct answer first
- Add context/explanation after
- End with a helpful follow-up tip when relevant
- Be factual, never hallucinate data

Current date: ${new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
Current time (IST): ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

const MODE_PROMPTS = {
  weather: `\nMODE: Weather Assistant. Use ONLY the provided live weather data. Format it beautifully with emojis. Explain what the weather means practically (e.g., "good day for outdoor activities" or "carry umbrella").`,
  news:    `\nMODE: News Briefing. Summarize the provided headlines clearly. Add brief context for each story. Be neutral and factual.`,
  sports:  `\nMODE: Sports Analyst. Use provided data. Give match scores, player highlights, and analysis. Use sports emojis ⚽🏏🎾.`,
  coding:  `\nMODE: Senior Developer. Write clean, commented, production-ready code. Explain the logic. Suggest best practices. Always test edge cases mentally.`,
  finance: `\nMODE: Finance Advisor. Use provided market data. Give clear analysis. Always add disclaimer that this is informational, not investment advice.`,
  search:  `\nMODE: Research Assistant. Synthesize the provided search results into a comprehensive, accurate answer. Cite sources where relevant.`,
  math:    `\nMODE: Mathematics Expert. Show step-by-step working. Use proper notation. Verify your calculations.`,
  general: `\nMODE: General Intelligence. Give comprehensive, accurate, well-structured answers.`,
};

// ── Creator check ─────────────────────────────────────────────────────────────
function isCreatorQuery(text) {
  const lower = text.toLowerCase();
  return ['who created you','who made you','who built you','your creator',
    'who is your father','abhishek verma','who is abhishek'].some(p => lower.includes(p));
}

// ── Fetch live context data ────────────────────────────────────────────────────
async function fetchLiveContext(queryMeta, text) {
  const ctx = { type: queryMeta.type, data: null, formatted: null, sources: [] };

  try {
    switch (queryMeta.type) {
      case 'weather': {
        const d = await getWeather(queryMeta.city);
        ctx.data      = d;
        ctx.formatted = formatWeatherForAI(d);
        ctx.sources   = [{ title: `Weather: ${d.city}`, url: 'https://openweathermap.org' }];
        break;
      }
      case 'news': {
        const topic = queryMeta.keywords[0] || 'india';
        const d = await getNews(topic);
        ctx.data      = d;
        ctx.formatted = formatNewsForAI(d);
        ctx.sources   = d.articles.slice(0, 3).map(a => ({ title: a.title, url: a.url || '#' }));
        break;
      }
      case 'search':
      case 'sports':
      case 'finance': {
        const d = await webSearch(text);
        ctx.data      = d;
        ctx.formatted = formatSearchForAI(d);
        ctx.sources   = d.results.map(r => ({ title: r.title, url: r.url }));
        break;
      }
    }
  } catch (err) {
    console.error('[LiveContext]', err.message);
  }

  return ctx;
}

// ── Build messages array for AI ────────────────────────────────────────────────
function buildMessages(conversationHistory, userMessage, liveContext, queryType) {
  const systemContent = BASE_SYSTEM + (MODE_PROMPTS[queryType] || MODE_PROMPTS.general);

  const messages = [{ role: 'user', parts: [{ text: systemContent }] }];

  // Add conversation history (last 10 messages for context window)
  const history = conversationHistory.slice(-10);
  history.forEach(m => {
    messages.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  });

  // Inject live context into user message
  let finalUserMessage = userMessage;
  if (liveContext?.formatted) {
    finalUserMessage = `${liveContext.formatted}\n\n---\nUser Question: ${userMessage}\n\nUsing ONLY the above live data, answer the user's question comprehensively.`;
  }

  messages.push({ role: 'user', parts: [{ text: finalUserMessage }] });
  return messages;
}

// ── Gemini call ────────────────────────────────────────────────────────────────
async function callGemini(messages) {
  const key   = process.env.GEMINI_API_KEY;
  const rawModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const model    = rawModel.includes('2.5') ? 'gemini-1.5-flash' : rawModel;
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const res = await axios.post(url, {
    contents: messages,
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048, topK: 40, topP: 0.95 },
  }, { timeout: 12000 });

  return res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'No response generated.';
}

// ── OpenAI call ────────────────────────────────────────────────────────────────
async function callOpenAI(conversationHistory, userMessage, liveContext, queryType) {
  const systemContent = BASE_SYSTEM + (MODE_PROMPTS[queryType] || MODE_PROMPTS.general);
  const apiMessages   = [{ role: 'system', content: systemContent }];

  conversationHistory.slice(-10).forEach(m => {
    apiMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  });

  let finalUser = userMessage;
  if (liveContext?.formatted) finalUser = `${liveContext.formatted}\n\nUser Question: ${userMessage}`;
  apiMessages.push({ role: 'user', content: finalUser });

  const res = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: apiMessages,
    max_tokens: 2048, temperature: 0.7,
  }, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    timeout: 25000,
  });

  return res.data?.choices?.[0]?.message?.content?.trim() || 'No response.';
}

// ── Mock response ──────────────────────────────────────────────────────────────
async function callMock(queryType) {
  await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
  const mocks = {
    weather: `## 🌤️ Current Weather\n\nRunning in **mock mode**. Configure \`WEATHER_API_KEY\` in \`.env\` for real weather data.\n\n**Mock Data:**\n- Temperature: 28°C\n- Condition: Partly Cloudy\n- Humidity: 65%`,
    news:    `## 📰 Latest News\n\nRunning in **mock mode**. Configure \`NEWS_API_KEY\` for real headlines.\n\n**Mock Headlines:**\n1. India Economy Shows Strong Q3 Growth\n2. Tech Industry Boom in AI Sector\n3. Budget 2025 Key Highlights`,
    coding:  `## 💻 Code Mode\n\nI'm running in **mock mode**. Configure an AI provider in \`.env\`:\n\`\`\`env\nAI_PROVIDER=gemini\nGEMINI_API_KEY=your_key\n\`\`\`\n\nThe Gemini key is already included by default!`,
    general: `## 🤖 GyaanAI\n\nI'm running in **mock mode**. The app works end-to-end.\n\nTo get real AI responses, ensure your \`.env\` has:\n\`\`\`\nAI_PROVIDER=gemini\nGEMINI_API_KEY=AIzaSyC1gAYHA77k-ERe0CZpUa9GoSEN-dkJWJk\n\`\`\``,
  };
  return mocks[queryType] || mocks.general;
}

// ── STREAMING RESPONSE (SSE) ───────────────────────────────────────────────────
async function streamGemini(messages, res) {
  const key      = process.env.GEMINI_API_KEY;
  const rawModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const model    = rawModel.includes('2.5') ? 'gemini-1.5-flash' : rawModel;
  const url      = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}&alt=sse`;

  try {
    const response = await axios.post(url, {
      contents: messages,
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }, {
      responseType: 'stream',
      timeout: 15000,
    });

    let fullText = '';

    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        try {
          const json = JSON.parse(line.replace('data: ', ''));
          const token = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (token) {
            fullText += token;
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          }
        } catch {}
      }
    });

    await new Promise((resolve, reject) => {
      response.data.on('end', resolve);
      response.data.on('error', reject);
    });

    res.write(`data: ${JSON.stringify({ done: true, fullText })}\n\n`);
    return fullText;
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    throw err;
  }
}

// ── MAIN ENTRY POINT ──────────────────────────────────────────────────────────
async function generateResponse(userMessage, conversationHistory = []) {
  // Creator override
  if (isCreatorQuery(userMessage)) {
    return {
      text: `## 👨‍💻 About My Creator\n\n**Abhishek Verma** created me — a passionate computer science student and professional coder who specializes in building intelligent systems.\n\nHe designed **GyaanAI** to be:\n- 🧠 Intelligent and context-aware\n- ⚡ Fast with real-time data\n- 🌐 Capable of live web search\n- 💻 Expert in coding assistance\n\n*Ask me anything — I'm here to help!*`,
      queryType: 'general',
      sources: [],
    };
  }

  // Classify the query
  const queryMeta = classifyQuery(userMessage);

  // Fetch live context if needed
  let liveContext = null;
  if (queryMeta.needsLiveData) {
    liveContext = await fetchLiveContext(queryMeta, userMessage);
  }

  // Build messages for AI
  const messages = buildMessages(conversationHistory, userMessage, liveContext, queryMeta.type);

  // Call the appropriate AI provider
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  let text;

  try {
    switch (provider) {
      case 'openai':    text = await callOpenAI(conversationHistory, userMessage, liveContext, queryMeta.type); break;
      case 'mock':      text = await callMock(queryMeta.type); break;
      case 'gemini':
      default:          text = await callGemini(messages); break;
    }
  } catch (err) {
    console.error(`[AI:${provider}]`, err.message);
    text = await callMock(queryMeta.type);
  }

  return {
    text,
    queryType:  queryMeta.type,
    sources:    liveContext?.sources || [],
    liveData:   !!liveContext?.data,
  };
}

// ── STREAMING ENTRY POINT ─────────────────────────────────────────────────────
async function streamResponse(userMessage, conversationHistory, res) {
  const queryMeta  = classifyQuery(userMessage);
  let liveContext  = null;

  if (queryMeta.needsLiveData) {
    liveContext = await fetchLiveContext(queryMeta, userMessage);
    // Send live context metadata first
    res.write(`data: ${JSON.stringify({ meta: { queryType: queryMeta.type, liveData: true, sources: liveContext?.sources || [] } })}\n\n`);
  }

  const messages = buildMessages(conversationHistory, userMessage, liveContext, queryMeta.type);
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

  if (provider === 'gemini') {
    return await streamGemini(messages, res);
  } else {
    // For non-streaming providers, simulate streaming
    const result = await generateResponse(userMessage, conversationHistory);
    const words  = result.text.split(' ');
    for (const word of words) {
      res.write(`data: ${JSON.stringify({ token: word + ' ' })}\n\n`);
      await new Promise(r => setTimeout(r, 12));
    }
    res.write(`data: ${JSON.stringify({ done: true, fullText: result.text })}\n\n`);
    return result.text;
  }
}

module.exports = { generateResponse, streamResponse };
