/**
 * Query Classifier — Detects the type of user query
 * and routes to the correct data source
 */

const PATTERNS = {
  weather: [
    /\b(weather|temperature|temp|forecast|humidity|rain|snow|wind|cloudy|sunny|hot|cold|climate)\b/i,
    /\b(aaj ka mausam|barish|garmi|sardi|thand)\b/i,
    /\bhow (hot|cold|warm|cool) is\b/i,
    /\b(degrees|celsius|fahrenheit|°c|°f)\b/i,
  ],
  news: [
    /\b(news|breaking|latest|headline|today|current events|update)\b/i,
    /\b(happening|incident|attack|election|protest|crisis|war|conflict)\b/i,
    /\b(aaj ki khabar|taza khabar|breaking news)\b/i,
  ],
  sports: [
    /\b(ipl|cricket|football|soccer|tennis|score|match|game|tournament|league|cup)\b/i,
    /\b(who won|winner|result|standing|ranking|playoff|final)\b/i,
    /\b(runs|wickets|goal|point|innings|over|ball|player|team)\b/i,
    /\b(nba|nfl|fifa|wwe|f1|formula 1|grand prix)\b/i,
  ],
  finance: [
    /\b(stock|share|price|market|nse|bse|sensex|nifty|crypto|bitcoin|eth|usd|inr|rupee)\b/i,
    /\b(invest|portfolio|dividend|ipo|mutual fund|rate|exchange)\b/i,
  ],
  coding: [
    /\b(code|program|function|algorithm|bug|error|debug|syntax|javascript|python|react|node|css|html|java|c\+\+|sql|api|rest|json)\b/i,
    /\b(how to (build|create|make|write|implement|fix))\b/i,
    /\b(what is (a|an)? (class|object|array|loop|variable|function|hook|component))\b/i,
    /```|<code>/i,
  ],
  math: [
    /\b(calculate|solve|equation|formula|integral|derivative|matrix|probability|statistics)\b/i,
    /\b(what is \d+|how much is \d+|\d+\s*[+\-*/]\s*\d+)\b/i,
  ],
  // ONLY trigger live search for genuinely real-time requests — NOT general knowledge
  search: [
    /\b(latest|recent|right now|as of today|this week|live update)\b/i,
    /\b(find online|search|look up|google|browse)\b/i,
  ],
};

const CITY_PATTERN = /\b(in|at|for|of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/;
const COMMON_CITIES = ['delhi','mumbai','bangalore','chennai','kolkata','hyderabad','pune','jaipur','london','new york','paris','tokyo','dubai','singapore','sydney','new delhi'];

/**
 * Classify query and extract metadata
 * @param {string} text - user message
 * @returns {{ type, city, confidence, keywords }}
 */
function classifyQuery(text) {
  const lower = text.toLowerCase().trim();

  // Score each category
  const scores = {};
  for (const [type, patterns] of Object.entries(PATTERNS)) {
    scores[type] = patterns.filter(p => p.test(lower)).length;
  }

  // Find highest score
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topType, topScore] = sorted[0];
  const type = topScore > 0 ? topType : 'general';

  // Extract city for weather queries
  let city = null;
  if (type === 'weather') {
    const cityMatch = lower.match(CITY_PATTERN);
    if (cityMatch) {
      city = cityMatch[2].toLowerCase();
    } else {
      // Check for known cities directly mentioned
      city = COMMON_CITIES.find(c => lower.includes(c)) || null;
    }
    if (!city) city = 'New Delhi'; // default city
  }

  // Extract keywords
  const stopwords = new Set(['the','a','an','is','in','of','and','or','for','to','what','how','who','when','where','does','did','has','have','i','me','my','please','can','you','tell','me']);
  const keywords = lower.split(/\W+/).filter(w => w.length > 2 && !stopwords.has(w));

  return {
    type,
    confidence: topScore,
    city,
    keywords: keywords.slice(0, 6),
    // needsLiveData only true when we have real patterns matched AND it's a live-data type
    needsLiveData: ['weather','news','sports','finance','search'].includes(type) && topScore > 0,
  };
}

module.exports = { classifyQuery };
