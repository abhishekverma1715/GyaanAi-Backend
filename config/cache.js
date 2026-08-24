const NodeCache = require('node-cache');

// Separate caches with different TTLs
const weatherCache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_WEATHER) || 600 });  // 10 min
const newsCache    = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_NEWS)    || 300 });   // 5 min
const searchCache  = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_SEARCH)  || 180 });   // 3 min
const generalCache = new NodeCache({ stdTTL: 3600 }); // 1 hour

const caches = { weather: weatherCache, news: newsCache, search: searchCache, general: generalCache };

module.exports = {
  get:   (type, key)        => caches[type]?.get(key),
  set:   (type, key, value) => caches[type]?.set(key, value),
  del:   (type, key)        => caches[type]?.del(key),
  flush: (type)             => caches[type]?.flushAll(),
  stats: ()                 => Object.fromEntries(Object.entries(caches).map(([k, c]) => [k, c.getStats()])),
};
