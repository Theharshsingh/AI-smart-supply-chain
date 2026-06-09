require('dotenv').config();
const axios = require('axios');
const { getHistoricalData, decodePolyline } = require('./data');

const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

// ── Open-Meteo WMO weather code → label ──────────────────────────────────────
function wmoToLabel(code) {
  if (code === 0 || code === 1) return 'Clear';
  if (code === 2 || code === 3) return 'Cloudy';
  if (code >= 45 && code <= 48) return 'Fog';
  if (code >= 51 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Rain'; // snow → Rain for risk purposes
  if (code >= 80 && code <= 82) return 'Rain';
  if (code >= 95 && code <= 99) return 'Storm';
  return 'Cloudy';
}

function wmoToDescription(code) {
  const MAP = {
    0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
    45:'Fog',48:'Icy fog',51:'Light drizzle',53:'Moderate drizzle',55:'Dense drizzle',
    61:'Slight rain',63:'Moderate rain',65:'Heavy rain',
    71:'Slight snow',73:'Moderate snow',75:'Heavy snow',
    80:'Slight rain showers',81:'Moderate rain showers',82:'Violent rain showers',
    95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with heavy hail',
  };
  return MAP[code] || 'Cloudy';
}

/**
 * Fetch current + hourly forecast from Open-Meteo (free, no API key).
 * Returns unified weather object compatible with the rest of the system.
 */
async function fetchWeather(lat, lng) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility` +
      `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility` +
      `&wind_speed_unit=kmh&forecast_days=2&timezone=auto`;
    const res = await axios.get(url, { timeout: 8000 });
    const c = res.data.current;
    const h = res.data.hourly;

    // Build 6-slot forecast (next 18h in 3h steps)
    const nowIdx = h.time.findIndex(t => new Date(t) >= new Date(c.time));
    const startIdx = Math.max(0, nowIdx);
    const forecast = [];
    for (let i = startIdx; i < startIdx + 18 && i < h.time.length; i += 3) {
      forecast.push({
        time: h.time[i],
        condition: wmoToLabel(h.weather_code[i]),
        temp: Math.round(h.temperature_2m[i]),
        description: wmoToDescription(h.weather_code[i]),
        pop: h.precipitation_probability?.[i] ?? 0,
        precipitation: h.precipitation?.[i] ?? 0,
        windSpeed: Math.round(h.wind_speed_10m?.[i] ?? 0),
        windGusts: Math.round(h.wind_gusts_10m?.[i] ?? 0),
        visibility: h.visibility?.[i] != null ? Math.round(h.visibility[i] / 1000) : null,
      });
    }

    return {
      condition:    wmoToLabel(c.weather_code),
      temp:         Math.round(c.temperature_2m),
      humidity:     c.relative_humidity_2m ?? 60,
      windSpeed:    Math.round(c.wind_speed_10m ?? 0),
      windGusts:    Math.round(c.wind_gusts_10m ?? 0),
      precipitation: c.precipitation ?? 0,
      visibility:   c.visibility != null ? Math.round(c.visibility / 1000) : null,
      description:  wmoToDescription(c.weather_code),
      weatherCode:  c.weather_code,
      forecast,
      source: 'open-meteo',
      // hourly arrays for ETA-matched lookup
      _hourly: h,
    };
  } catch (err) {
    console.error('[Weather/OpenMeteo]', err.message);
    // Dynamic heuristic based on time of day and season
    const mo = new Date().getMonth(); // 0-11
    const hr = new Date().getHours();
    const baseTemp = mo >= 2 && mo <= 5 ? 36 : mo >= 6 && mo <= 8 ? 30 : mo >= 9 && mo <= 10 ? 28 : 22;
    const timeAdj = hr >= 12 && hr <= 16 ? 3 : hr >= 20 || hr <= 5 ? -4 : 0;
    return { condition: 'Clear', temp: baseTemp + timeAdj, humidity: 60, windSpeed: 12, windGusts: 15,
      precipitation: 0, visibility: 10, description: 'clear sky', forecast: [], source: 'heuristic' };
  }
}

// ── Traffic (Distance Matrix) — supports place_id or lat/lng ────────────────
async function fetchTraffic(oLat, oLng, dLat, dLng, oPlaceId = null, dPlaceId = null) {
  if (!GMAPS_KEY || GMAPS_KEY.startsWith('your_')) {
    const hour = new Date().getHours();
    const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
    const congestion = parseFloat((isPeak ? 0.6 : 0.22 + Math.random() * 0.15).toFixed(2));
    return { congestion, durationMin: null, durationTrafficMin: null, distanceKm: null, source: 'heuristic' };
  }
  try {
    // Prefer place_id for accuracy with local addresses
    const origin      = oPlaceId ? `place_id:${oPlaceId}` : `${oLat},${oLng}`;
    const destination = dPlaceId ? `place_id:${dPlaceId}` : `${dLat},${dLng}`;
    const res = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: { origins: origin, destinations: destination, departure_time: 'now', traffic_model: 'best_guess', key: GMAPS_KEY },
      timeout: 8000,
    });
    const el = res.data.rows?.[0]?.elements?.[0];
    if (!el || el.status !== 'OK') throw new Error(el?.status || 'no element');
    const dMin  = el.duration.value / 60;
    const dtMin = (el.duration_in_traffic?.value || el.duration.value) / 60;
    const ratio = dtMin / dMin;
    return {
      congestion: parseFloat(Math.min(1, Math.max(0, (ratio - 1) / 1.5)).toFixed(2)),
      durationMin: Math.round(dMin),
      durationTrafficMin: Math.round(dtMin),
      distanceKm: Math.round(el.distance.value / 1000),
      source: 'google',
    };
  } catch (err) {
    console.error('[Traffic]', err.message);
    const hour = new Date().getHours();
    const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
    return { congestion: isPeak ? 0.55 : 0.25, durationMin: null, durationTrafficMin: null, distanceKm: null, source: 'heuristic_fallback', error: err.message };
  }
}

// ── Directions — supports place_id or lat/lng ─────────────────────────────────
async function fetchDirections(oLat, oLng, dLat, dLng, oPlaceId = null, dPlaceId = null) {
  if (!GMAPS_KEY || GMAPS_KEY.startsWith('your_')) return null;
  try {
    const origin      = oPlaceId ? `place_id:${oPlaceId}` : `${oLat},${oLng}`;
    const destination = dPlaceId ? `place_id:${dPlaceId}` : `${dLat},${dLng}`;
    const res = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: { origin, destination, departure_time: 'now', traffic_model: 'best_guess', alternatives: true, key: GMAPS_KEY },
      timeout: 10000,
    });
    if (res.data.status !== 'OK') {
      console.error('[Directions] status:', res.data.status, res.data.error_message || '');
      return null;
    }
    return res.data.routes.map((r, i) => ({
      index: i,
      summary: r.summary,
      distanceKm: Math.round(r.legs[0].distance.value / 1000),
      durationMin: Math.round(r.legs[0].duration.value / 60),
      durationTrafficMin: Math.round((r.legs[0].duration_in_traffic?.value || r.legs[0].duration.value) / 60),
      polyline: decodePolyline(r.overview_polyline.points),
      bounds: r.bounds,
    }));
  } catch (err) {
    console.error('[Directions]', err.message);
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function worstForecastCondition(forecast = []) {
  const sev = { Clear: 0, Cloudy: 1, Rain: 2, Fog: 3, Storm: 4 };
  return forecast.reduce((w, f) => (sev[f.condition] || 0) > (sev[w] || 0) ? f.condition : w, 'Clear');
}

function buildAlerts(weatherData, trafficData, forecastWorst) {
  const alerts = [];
  const { condition, windSpeed = 0 } = weatherData;
  const { congestion = 0 } = trafficData;

  if (condition === 'Storm')  alerts.push({ type: 'danger',  msg: '⛈️ Storm on route — immediate rerouting advised' });
  if (condition === 'Rain')   alerts.push({ type: 'warning', msg: '🌧️ Rain reducing visibility — road delays expected' });
  if (condition === 'Fog')    alerts.push({ type: 'warning', msg: '🌫️ Dense fog — reduced road visibility' });
  if (windSpeed > 60)         alerts.push({ type: 'danger',  msg: `💨 High winds ${windSpeed} km/h — air transport risk elevated` });

  if (forecastWorst === 'Storm') alerts.push({ type: 'danger',  msg: '⚠️ Storm forecast in next 3h — pre-emptive rerouting recommended' });
  else if (forecastWorst === 'Rain') alerts.push({ type: 'warning', msg: '🌦️ Rain expected in next 2–3h — monitor road routes' });

  if (congestion > 0.75) alerts.push({ type: 'danger',  msg: `🚦 Severe congestion (${Math.round(congestion * 100)}%) — alternate route recommended` });
  else if (congestion > 0.5) alerts.push({ type: 'warning', msg: `🚗 Moderate traffic (${Math.round(congestion * 100)}%) — expect delays` });

  if (trafficData.source === 'google' && trafficData.durationTrafficMin && trafficData.durationMin) {
    const extra = trafficData.durationTrafficMin - trafficData.durationMin;
    if (extra > 15) alerts.push({ type: 'warning', msg: `⏱️ Live traffic adding ${extra} min to road ETA` });
  }
  return alerts;
}

function buildInsights(origin, dest, weatherData, trafficData) {
  const hist = getHistoricalData(origin, dest);
  const hour = new Date().getHours();
  const insights = [];
  const forecastWorst = worstForecastCondition(weatherData.forecast);

  if (forecastWorst !== 'Clear') insights.push(`🔮 ${forecastWorst} forecast in next 3h — risk will increase`);

  const nextPeak = hist.peakHours.find(h => h > hour);
  if (nextPeak) insights.push(`⏰ Peak traffic expected at ${nextPeak}:00 on ${origin}→${dest} corridor`);

  insights.push(`📊 Historical avg delay on this route: ${Math.round(hist.avgDelay * 100)}%`);

  if (trafficData.source === 'google' && trafficData.durationTrafficMin) {
    insights.push(`🗺️ Google Maps live ETA: ${trafficData.durationTrafficMin} min (free-flow: ${trafficData.durationMin} min)`);
  }

  const highPopForecast = weatherData.forecast?.find(f => f.pop > 60);
  if (highPopForecast) insights.push(`🌧️ ${highPopForecast.pop}% chance of rain at ${highPopForecast.time?.slice(11, 16)} — road risk elevated`);

  if (weatherData.humidity > 80) insights.push(`💧 High humidity (${weatherData.humidity}%) — fog risk elevated overnight`);

  return insights;
}

// ── OSRM Routing (free, no key needed) ───────────────────────────────────────
function realisticDuration(osrmSeconds, distanceM) {
  const distKm = distanceM / 1000;
  const factor = distKm < 50 ? 1.5 : distKm < 150 ? 1.42 : 1.38;
  const restStops = Math.floor((osrmSeconds * factor / 3600) / 4) * 15 * 60;
  return Math.round((osrmSeconds * factor + restStops) / 60);
}

async function fetchOSRMRoute(oLat, oLng, dLat, dLng) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`;
    const res = await axios.get(url, { timeout: 10000 });
    if (res.data.code !== 'Ok' || !res.data.routes?.length) return null;
    const route = res.data.routes[0];
    const coords = route.geometry.coordinates; // [[lng, lat], ...]
    const polyline = coords.map(([lng, lat]) => ({ lat, lng }));
    const distanceKm = Math.round(route.distance / 1000);
    const durationMin = realisticDuration(route.duration, route.distance);
    console.log(`[OSRM] ${distanceKm} km, ${durationMin} min (realistic)`);
    return [{
      index: 0,
      summary: 'OSRM Route',
      distanceKm,
      durationMin,
      durationTrafficMin: durationMin,
      polyline,
      geojson: route.geometry,
    }];
  } catch (e) {
    console.error('[OSRM]', e.message);
    return null;
  }
}

// ── ETA-matched weather fetch using Open-Meteo hourly data ───────────────────
/**
 * Fetch weather matched to the exact ETA time using Open-Meteo hourly forecast.
 * Finds the hourly slot closest to the ETA timestamp — no API key needed.
 */
async function fetchWeatherWithEta(lat, lng, etaMs) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility` +
      `&wind_speed_unit=kmh&forecast_days=2&timezone=auto`;
    const res = await axios.get(url, { timeout: 8000 });
    const h = res.data.hourly;
    if (!h?.time?.length) throw new Error('empty hourly');

    // Find hourly slot closest to ETA
    const etaSec = etaMs / 1000;
    let bestIdx = 0, bestDiff = Infinity;
    h.time.forEach((t, i) => {
      const diff = Math.abs(new Date(t).getTime() / 1000 - etaSec);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    });

    const code = h.weather_code[bestIdx];
    return {
      condition:    wmoToLabel(code),
      temp:         Math.round(h.temperature_2m[bestIdx]),
      humidity:     h.relative_humidity_2m?.[bestIdx] ?? 60,
      windSpeed:    Math.round(h.wind_speed_10m?.[bestIdx] ?? 0),
      windGusts:    Math.round(h.wind_gusts_10m?.[bestIdx] ?? 0),
      precipitation: h.precipitation?.[bestIdx] ?? 0,
      precipProb:   h.precipitation_probability?.[bestIdx] ?? 0,
      visibility:   h.visibility?.[bestIdx] != null ? Math.round(h.visibility[bestIdx] / 1000) : null,
      description:  wmoToDescription(code),
      weatherCode:  code,
      forecast:     [],
      source:       'open-meteo-forecast',
      forecastTime: h.time[bestIdx],
    };
  } catch (err) {
    console.error('[WeatherEta/OpenMeteo]', err.message);
    return fetchWeather(lat, lng);
  }
}

module.exports = { fetchWeather, fetchWeatherWithEta, fetchTraffic, fetchDirections, fetchOSRMRoute, buildAlerts, buildInsights, worstForecastCondition };
