/**
 * weatherService.js
 * Fetches weather data for route points via the local server proxy.
 * The server holds the OPENWEATHER_API_KEY securely in its .env.
 *
 * When a point has an `etaTimestamp`, we pass it to the server so the
 * server can return the OWM hourly forecast slot closest to the ETA,
 * rather than always returning current weather.
 */

import { cacheGet, cacheSet, makeCacheKey, purgeExpired } from './cacheLayer';
import { API_URL } from '../api';

// ── Fetch with exponential back-off ──────────────────────────────────────────
async function fetchWithRetry(url, retries = 3, baseDelayMs = 600) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 2)));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
}

/**
 * Build a cache key that includes the ETA hour bucket (rounds to nearest hour)
 * so that different ETAs at the same location get separate cache entries.
 */
function makeEtaCacheKey(lat, lng, etaTimestampMs) {
  const base = makeCacheKey(lat, lng);
  if (!etaTimestampMs) return base;
  const etaHour = Math.floor(etaTimestampMs / (60 * 60 * 1000)); // hour bucket
  return `${base}@h${etaHour}`;
}

/**
 * Fetch weather for a single coordinate, optionally ETA-matched.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number|null} etaTimestampMs – absolute Unix ms for ETA-matched forecast
 * @returns {Promise<WeatherData|null>}
 */
export async function fetchWeatherForPoint(lat, lng, etaTimestampMs = null) {
  const key = makeEtaCacheKey(lat, lng, etaTimestampMs);
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    let url = `${API_URL}/api/weather?lat=${lat}&lng=${lng}`;
    if (etaTimestampMs) url += `&eta=${etaTimestampMs}`;

    const data = await fetchWithRetry(url);
    if (!data || data.error) return null;

    const result = {
      condition:   data.condition   || 'Clear',
      temp:        data.temp        ?? 0,
      humidity:    data.humidity    ?? 0,
      windSpeed:   data.windSpeed   ?? 0,   // km/h from server
      description: data.description || '',
      visibility:  data.visibility  ?? null,
      source:      data.source      || 'heuristic',
      forecastTime: data.forecastTime || null,
    };

    cacheSet(key, result);
    return result;
  } catch {
    return null;
  }
}

/**
 * Fetch weather for all sampled route points with controlled concurrency.
 * Passes etaTimestamp to enable server-side forecast matching.
 *
 * @param {Array<{lat, lng, distFromStartKm, etaMs, etaTimestamp?}>} points
 * @param {number} concurrency – parallel fetches per batch (default 3)
 * @returns {Promise<Array<{...point, weather: WeatherData|null}>>}
 */
export async function fetchWeatherForRoute(points, concurrency = 3) {
  if (!points?.length) return [];

  purgeExpired();

  const results = [];

  for (let i = 0; i < points.length; i += concurrency) {
    const chunk = points.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(pt =>
        fetchWeatherForPoint(pt.lat, pt.lng, pt.etaTimestamp ?? null)
          .then(weather => ({ ...pt, weather }))
      )
    );
    results.push(...chunkResults);

    // Small inter-batch delay to respect server-side rate limits
    if (i + concurrency < points.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return results;
}
