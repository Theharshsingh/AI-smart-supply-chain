/**
 * weatherService.js
 * Fetches real ETA-matched weather for each route checkpoint from Open-Meteo.
 * Strategy: fetch hourly forecast ONCE per unique location cluster, then match
 * each checkpoint's ETA to the correct hourly slot — real temp, rain, wind per checkpoint.
 */

import { cacheGet, cacheSet, purgeExpired } from './cacheLayer';

const WMO_LABEL = {
  0:'Clear',1:'Clear',2:'Cloudy',3:'Cloudy',
  45:'Fog',48:'Fog',
  51:'Rain',53:'Rain',55:'Rain',
  61:'Rain',63:'Rain',65:'Rain',
  71:'Snow',73:'Snow',75:'Snow',
  80:'Rain',81:'Rain',82:'Rain',
  95:'Storm',96:'Storm',99:'Storm',
};
const WMO_DESC = {
  0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
  45:'Fog',48:'Icy fog',51:'Light drizzle',53:'Moderate drizzle',55:'Dense drizzle',
  61:'Slight rain',63:'Moderate rain',65:'Heavy rain',
  80:'Slight showers',81:'Moderate showers',82:'Violent showers',
  95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm heavy hail',
};
const wmoLabel = c => WMO_LABEL[c] || 'Cloudy';
const wmoDesc  = c => WMO_DESC[c]  || 'Cloudy';

/** Round to 1 decimal (~11 km grid) for deduplication of nearby points */
function gridKey(lat, lng) {
  return `${lat.toFixed(1)},${lng.toFixed(1)}`;
}

/**
 * Fetch Open-Meteo hourly data for a location (cached per grid cell, 10 min TTL).
 * Returns the raw hourly arrays so we can match any ETA slot.
 */
async function fetchHourlyData(lat, lng) {
  const key = `hourly:${gridKey(lat, lng)}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,` +
    `weather_code,wind_speed_10m,wind_gusts_10m,visibility` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,` +
    `wind_speed_10m,wind_gusts_10m,visibility` +
    `&wind_speed_unit=kmh&forecast_days=2&timezone=auto`;

  const res  = await fetch(url);
  const data = await res.json();
  if (!data?.hourly?.time?.length) throw new Error('empty response');

  // Pre-convert hourly times to ms for fast lookup
  data.hourly._timesMs = data.hourly.time.map(t => new Date(t).getTime());
  cacheSet(key, data, 10 * 60 * 1000);
  return data;
}

/** Find the hourly index closest to a given timestamp (ms) */
function closestHourlyIdx(timesMs, targetMs) {
  let best = 0, bestDiff = Infinity;
  for (let i = 0; i < timesMs.length; i++) {
    const d = Math.abs(timesMs[i] - targetMs);
    if (d < bestDiff) { bestDiff = d; best = i; }
    if (timesMs[i] > targetMs + 2 * 3600_000) break; // no need to search further
  }
  return best;
}

/** Extract weather object from hourly slot */
function slotToWeather(h, idx, forecastTimeStr) {
  const code = h.weather_code[idx];
  return {
    condition:    wmoLabel(code),
    description:  wmoDesc(code),
    temp:         Math.round(h.temperature_2m[idx]),
    humidity:     h.relative_humidity_2m?.[idx] ?? 0,
    windSpeed:    Math.round(h.wind_speed_10m?.[idx] ?? 0),
    windGusts:    Math.round(h.wind_gusts_10m?.[idx] ?? 0),
    precipitation: h.precipitation?.[idx] ?? 0,
    precipProb:   h.precipitation_probability?.[idx] ?? 0,
    visibility:   h.visibility?.[idx] != null ? Math.round(h.visibility[idx] / 1000) : null,
    weatherCode:  code,
    forecastTime: forecastTimeStr,
    source:       'open-meteo',
  };
}

/**
 * Main export: fetch real ETA-matched weather for every checkpoint.
 * Groups nearby points to avoid duplicate API calls.
 * Each checkpoint gets the hourly slot matching its ETA timestamp.
 */
export async function fetchWeatherForRoute(points) {
  if (!points?.length) return [];
  purgeExpired();

  // Group points by grid cell to minimise API calls
  const groups = new Map(); // gridKey → [point indices]
  points.forEach((pt, i) => {
    const k = gridKey(pt.lat, pt.lng);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  });

  // Fetch hourly data for each unique grid cell (in parallel, max 3 at a time)
  const gridKeys = [...groups.keys()];
  const hourlyByGrid = new Map();

  for (let i = 0; i < gridKeys.length; i += 3) {
    const chunk = gridKeys.slice(i, i + 3);
    await Promise.all(chunk.map(async gk => {
      const idx0   = groups.get(gk)[0];
      const pt     = points[idx0];
      try {
        const data = await fetchHourlyData(pt.lat, pt.lng);
        hourlyByGrid.set(gk, data);
      } catch {
        hourlyByGrid.set(gk, null);
      }
    }));
    if (i + 3 < gridKeys.length) await new Promise(r => setTimeout(r, 200));
  }

  // Assign ETA-matched weather to each point
  return points.map(pt => {
    const gk   = gridKey(pt.lat, pt.lng);
    const data = hourlyByGrid.get(gk);

    if (!data) return { ...pt, weather: null };

    const h       = data.hourly;
    const timesMs = h._timesMs;
    const etaMs   = pt.etaTimestamp ?? Date.now();
    const idx     = closestHourlyIdx(timesMs, etaMs);
    const weather = slotToWeather(h, idx, h.time[idx]);

    return { ...pt, weather };
  });
}
