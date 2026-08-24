const axios = require('axios');
const cache = require('../config/cache');

const BASE = 'https://api.openweathermap.org/data/2.5';

/**
 * Fetch current weather for a city
 */
async function getWeather(city = 'New Delhi') {
  const cacheKey = `weather:${city.toLowerCase()}`;
  const cached   = cache.get('weather', cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const key = process.env.WEATHER_API_KEY;
  if (!key || key === 'your_openweathermap_key') {
    return getMockWeather(city);
  }

  try {
    const [current, forecast] = await Promise.all([
      axios.get(`${BASE}/weather`, { params: { q: city, appid: key, units: 'metric' }, timeout: 5000 }),
      axios.get(`${BASE}/forecast`, { params: { q: city, appid: key, units: 'metric', cnt: 5 }, timeout: 5000 }),
    ]);

    const data = {
      city:        current.data.name,
      country:     current.data.sys.country,
      temp:        Math.round(current.data.main.temp),
      feelsLike:   Math.round(current.data.main.feels_like),
      humidity:    current.data.main.humidity,
      description: current.data.weather[0].description,
      wind:        Math.round(current.data.wind.speed * 3.6), // m/s → km/h
      visibility:  (current.data.visibility / 1000).toFixed(1),
      pressure:    current.data.main.pressure,
      icon:        current.data.weather[0].main,
      forecast:    forecast.data.list.slice(0, 5).map(f => ({
        time: new Date(f.dt * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        temp: Math.round(f.main.temp),
        desc: f.weather[0].main,
      })),
      fetchedAt: new Date().toISOString(),
    };

    cache.set('weather', cacheKey, data);
    return data;
  } catch (err) {
    console.error('[Weather API]', err.message);
    return getMockWeather(city);
  }
}

function getMockWeather(city) {
  const temps = { 'new delhi': 32, 'mumbai': 30, 'bangalore': 25, 'chennai': 33, 'kolkata': 28 };
  const temp  = temps[city.toLowerCase()] || 28;
  return {
    city, temp, feelsLike: temp + 2, humidity: 65,
    description: 'partly cloudy', wind: 14, visibility: 8.0,
    pressure: 1012, icon: 'Clouds',
    forecast: [],
    isMock: true, fetchedAt: new Date().toISOString(),
    note: 'Configure WEATHER_API_KEY in .env for real data',
  };
}

/**
 * Format weather data into readable text for AI
 */
function formatWeatherForAI(data) {
  return `LIVE WEATHER DATA for ${data.city}${data.country ? `, ${data.country}` : ''}:
- Temperature: ${data.temp}°C (Feels like ${data.feelsLike}°C)
- Condition: ${data.description}
- Humidity: ${data.humidity}%
- Wind: ${data.wind} km/h
- Visibility: ${data.visibility} km
- Pressure: ${data.pressure} hPa
- Data fetched at: ${new Date(data.fetchedAt).toLocaleTimeString('en-IN')}
${data.isMock ? '\n⚠️ [Mock data - Configure WEATHER_API_KEY for real weather]' : ''}`;
}

module.exports = { getWeather, formatWeatherForAI };
