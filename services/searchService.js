const axios = require('axios');
const cache = require('../config/cache');

/**
 * Web search using Brave Search API
 */
async function webSearch(query, count = 5) {
  const cacheKey = `search:${query.toLowerCase().substring(0, 60)}`;
  const cached   = cache.get('search', cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const key = process.env.BRAVE_SEARCH_KEY;
  if (!key || key === 'your_brave_search_key') {
    return getMockSearch(query);
  }

  try {
    const res = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': key,
      },
      params: { q: query, count, country: 'IN', search_lang: 'en', freshness: 'pd' },
      timeout: 6000,
    });

    const results = (res.data.web?.results || []).slice(0, count).map(r => ({
      title:       r.title,
      url:         r.url,
      description: r.description?.substring(0, 200),
      age:         r.age,
    }));

    const data = { query, results, fetchedAt: new Date().toISOString() };
    cache.set('search', cacheKey, data);
    return data;
  } catch (err) {
    console.error('[Search API]', err.message);
    return getMockSearch(query);
  }
}

function getMockSearch(query) {
  return {
    query, isMock: true,
    results: [
      { title: `Search results for: ${query}`, description: `Live search results about "${query}" would appear here with BRAVE_SEARCH_KEY configured.`, url: '#' },
    ],
    fetchedAt: new Date().toISOString(),
    note: 'Configure BRAVE_SEARCH_KEY in .env for real web search',
  };
}

/**
 * Format search results for AI context
 */
function formatSearchForAI(data) {
  if (data.isMock || data.results.length === 0) {
    return `No live search results available. Configure BRAVE_SEARCH_KEY in .env for real web search.`;
  }
  const lines = data.results.map((r, i) =>
    `${i+1}. **${r.title}**\n   ${r.description || ''}\n   Source: ${r.url}`
  );
  return `WEB SEARCH RESULTS for "${data.query}":\n${lines.join('\n\n')}\nFetched: ${new Date(data.fetchedAt).toLocaleTimeString('en-IN')}`;
}

module.exports = { webSearch, formatSearchForAI };
