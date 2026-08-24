const axios = require('axios');
const cache = require('../config/cache');

/**
 * Fetch top headlines
 */
async function getNews(topic = 'india', count = 5) {
  const cacheKey = `news:${topic}:${count}`;
  const cached   = cache.get('news', cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const key = process.env.NEWS_API_KEY;
  if (!key || key === 'your_newsapi_key') {
    return getMockNews(topic);
  }

  try {
    const params = topic === 'india' || topic === 'general'
      ? { country: 'in', pageSize: count, apiKey: key }
      : { q: topic, pageSize: count, apiKey: key, sortBy: 'publishedAt', language: 'en' };

    const res = await axios.get('https://newsapi.org/v2/top-headlines', { params, timeout: 6000 });

    const data = {
      topic,
      articles: (res.data.articles || []).slice(0, count).map(a => ({
        title:       a.title,
        source:      a.source?.name,
        url:         a.url,
        publishedAt: a.publishedAt,
        description: a.description?.substring(0, 150),
      })),
      fetchedAt: new Date().toISOString(),
    };

    cache.set('news', cacheKey, data);
    return data;
  } catch (err) {
    console.error('[News API]', err.message);
    return getMockNews(topic);
  }
}

function getMockNews(topic) {
  return {
    topic,
    isMock: true,
    articles: [
      { title: 'India Economy Shows Strong Growth in Q3', source: 'Economic Times', publishedAt: new Date().toISOString() },
      { title: 'Tech Industry Sees Surge in AI Adoption', source: 'Times of India', publishedAt: new Date().toISOString() },
      { title: 'Indian Cricket Team Wins Test Series', source: 'NDTV Sports', publishedAt: new Date().toISOString() },
      { title: 'Budget 2025 Key Highlights Announced', source: 'Business Standard', publishedAt: new Date().toISOString() },
      { title: 'New Metro Lines to Open in Major Cities', source: 'Hindustan Times', publishedAt: new Date().toISOString() },
    ],
    fetchedAt: new Date().toISOString(),
    note: 'Configure NEWS_API_KEY in .env for real news',
  };
}

/**
 * Format news for AI context
 */
function formatNewsForAI(data) {
  const lines = data.articles.map((a, i) =>
    `${i+1}. **${a.title}** — ${a.source || 'Unknown'} (${new Date(a.publishedAt).toLocaleDateString('en-IN')})`
  );

  return `LATEST NEWS${data.topic !== 'general' ? ` on "${data.topic}"` : ''}:
${lines.join('\n')}
${data.isMock ? '\n⚠️ [Mock data - Configure NEWS_API_KEY for real news]' : ''}
Data fetched: ${new Date(data.fetchedAt).toLocaleTimeString('en-IN')}`;
}

module.exports = { getNews, formatNewsForAI };
