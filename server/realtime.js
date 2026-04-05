require('dotenv').config();
const axios = require('axios');
const { getHistoricalData, decodePolyline } = require('./data');

const OWM_KEY  = process.env.OPENWEATHER_API_KEY;
const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

// ── Weather ───────────────────────────────────────────────────────────────────
function owmIdToLabel(id) {
  if (id >= 200 && id < 300) return 'Storm';
  if (id >= 300 && id < 600) return 'Rain';
  if (id >= 600 && id < 700) return 'Rain';
  if (id === 741 || id === 721 || (id >= 700 && id < 800)) return 'Fog';
  if (id === 800) return 'Clear';
  return 'Cloudy';
}

async function fetchWeather(lat, lng) {
  if (!OWM_KEY || OWM_KEY.startsWith('your_')) {
    return { condition: 'Clear', temp: 28, humidity: 60, windSpeed: 12, description: 'clear sky', forecast: [], source: 'heuristic' };
  }
  try {
    const [cur, fc] = await Promise.all([
      axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OWM_KEY}&units=metric`, { timeout: 7000 }),
      axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${OWM_KEY}&units=metric&cnt=6`, { timeout: 7000 }),
    ]);
    const w = cur.data;
    return {
      condition: owmIdToLabel(w.weather[0].id),
      temp: Math.round(w.main.temp),
      feelsLike: Math.round(w.main.feels_like),
      humidity: w.main.humidity,
      windSpeed: Math.round(w.wind.speed * 3.6),
      visibility: w.visibility ? Math.round(w.visibility / 1000) : null,
      description: w.weather[0].description,
      forecast: fc.data.list.slice(0, 6).map(f => ({
        time: f.dt_txt,
        condition: owmIdToLabel(f.weather[0].id),
        temp: Math.round(f.main.temp),
        description: f.weather[0].description,
        pop: Math.round((f.pop || 0) * 100), // precipitation probability %
      })),
      source: 'openweathermap',
    };
  } catch (err) {
    console.error('[Weather]', err.message);
    return { condition: 'Clear', temp: 28, humidity: 60, windSpeed: 12, description: 'clear sky', forecast: [], source: 'heuristic', error: err.message };
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
async function fetchOSRMRoute(oLat, oLng, dLat, dLng) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`;
    const res = await axios.get(url, { timeout: 10000 });
    if (res.data.code !== 'Ok' || !res.data.routes?.length) return null;
    const route = res.data.routes[0];
    const coords = route.geometry.coordinates; // [[lng, lat], ...]
    const polyline = coords.map(([lng, lat]) => ({ lat, lng }));
    const distanceKm = Math.round(route.distance / 1000);
    const durationMin = Math.round(route.duration / 60);
    console.log(`[OSRM] ${distanceKm} km, ${durationMin} min`);
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

module.exports = { fetchWeather, fetchTraffic, fetchDirections, fetchOSRMRoute, buildAlerts, buildInsights, worstForecastCondition };
