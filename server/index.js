require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors   = require('cors');
const cron   = require('node-cron');

const { generateShipments, interpolate, advanceAlongPolyline, geocodePlace, getAutocompleteSuggestions } = require('./data');
const { generateRoutes, calculateRisk, haversineKm } = require('./engine');
const { fetchWeather, fetchWeatherWithEta, fetchTraffic, fetchDirections, fetchOSRMRoute, buildAlerts, buildInsights, worstForecastCondition } = require('./realtime');
const { recordTraffic, predictCongestion, predictNextHours, getTrafficPattern } = require('./trafficLearning');
const { buildTrainRoute } = require('./trainIntelligence');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// ── State ─────────────────────────────────────────────────────────────────────
let shipments = generateShipments(6);

let globalEnv = {
  traffic: 0.3, weather: 'Clear', forecastWorst: 'Clear',
  weatherData: { condition: 'Clear', temp: 28, humidity: 60, windSpeed: 12, description: 'clear sky', forecast: [], source: 'heuristic' },
  trafficData: { congestion: 0.3, source: 'heuristic' },
  directionsData: null,
  alerts: [], lastUpdated: new Date().toISOString(),
  apiStatus: { weather: 'pending', traffic: 'pending', directions: 'pending' },
};

// ── Global env refresh ────────────────────────────────────────────────────────
async function refreshGlobalEnv() {
  const s = shipments[0];
  if (!s) return;
  try {
    const [weatherData, trafficData, directionsData] = await Promise.all([
      fetchWeather(s.currentLocation.lat, s.currentLocation.lng),
      fetchTraffic(s.currentLocation.lat, s.currentLocation.lng, s.destCoords.lat, s.destCoords.lng),
      fetchDirections(s.currentLocation.lat, s.currentLocation.lng, s.destCoords.lat, s.destCoords.lng),
    ]);
    const forecastWorst = worstForecastCondition(weatherData.forecast || []);

    // Record traffic for learning
    recordTraffic(s.currentLocation.lat, s.currentLocation.lng, trafficData.congestion);

    globalEnv = {
      traffic: trafficData.congestion,
      weather: weatherData.condition,
      forecastWorst,
      weatherData,
      trafficData,
      directionsData,
      alerts: buildAlerts(weatherData, trafficData, forecastWorst),
      lastUpdated: new Date().toISOString(),
      apiStatus: {
        weather: weatherData.source === 'openweathermap' ? 'live' : 'heuristic',
        traffic: trafficData.source,
        directions: directionsData ? 'live' : 'unavailable',
      },
    };
    console.log(`[Refresh] weather=${globalEnv.weather} traffic=${Math.round(globalEnv.traffic * 100)}% dirs=${directionsData?.length || 0}`);
  } catch (e) {
    console.error('[refreshGlobalEnv]', e.message);
  }
}

// ── Shipment tick ─────────────────────────────────────────────────────────────
function tickShipments() {
  shipments = shipments.map(s => {
    const speedFactor   = s.currentMode === 'AIR' ? 0.010 : s.currentMode === 'TRAIN' ? 0.006 : 0.003;
    const trafficPenalty = s.currentMode === 'ROAD' ? globalEnv.traffic * 0.002 : 0;
    const effectiveSpeed = Math.max(0.001, speedFactor - trafficPenalty);

    const poly = s.polyline || globalEnv.directionsData?.[0]?.polyline;
    let newProgress, newLocation;
    if (poly?.length > 1) {
      const r = advanceAlongPolyline(poly, s.progress, effectiveSpeed);
      newProgress = r.progress;
      newLocation = r.location || s.currentLocation;
    } else {
      newProgress = Math.min(1, s.progress + effectiveSpeed);
      newLocation = interpolate(s.originCoords, s.destCoords, newProgress);
    }

    // Record traffic learning
    recordTraffic(newLocation.lat, newLocation.lng, globalEnv.traffic);

    const weather      = globalEnv.weather;
    const forecastWorst = globalEnv.forecastWorst;
    const traffic      = globalEnv.traffic;
    const risk         = calculateRisk(traffic, weather, s.origin, s.destination, forecastWorst, newLocation.lat, newLocation.lng);
    const riskScore    = Math.round(risk * 100);
    const status       = riskScore > 65 ? 'Delayed' : riskScore > 40 ? 'Risk' : 'On-time';

    // Auto-Decision Engine
    let currentMode = s.currentMode, autoSwitched = false, autoSwitchReason = null;
    if (currentMode === 'ROAD') {
      if (weather === 'Storm' || traffic > 0.82) {
        currentMode = 'AIR'; autoSwitched = true;
        autoSwitchReason = weather === 'Storm' ? '🤖 Auto-switched to AIR: Storm detected' : `🤖 Auto-switched to AIR: Traffic ${Math.round(traffic * 100)}% critical`;
      } else if (traffic > 0.65 || weather === 'Rain' || weather === 'Fog') {
        currentMode = 'TRAIN'; autoSwitched = true;
        autoSwitchReason = traffic > 0.65 ? `🤖 Auto-switched to TRAIN: Traffic ${Math.round(traffic * 100)}% high` : `🤖 Auto-switched to TRAIN: ${weather} on road`;
      }
    }

    const dist = haversineKm(s.originCoords, s.destCoords);
    const remaining = dist * (1 - newProgress);
    const spd = currentMode === 'AIR' ? 800 : currentMode === 'TRAIN' ? 90 : 60 * (1 - traffic * 0.4);
    const eta = Math.max(0.1, remaining / spd);

    return { ...s, progress: newProgress, currentLocation: newLocation, riskScore, status, currentMode, eta: parseFloat(eta.toFixed(1)), autoSwitched, autoSwitchReason };
  });

  io.emit('update', { shipments, env: globalEnv });
}

cron.schedule('*/30 * * * * *', refreshGlobalEnv);
setInterval(tickShipments, 4000);

refreshGlobalEnv().then(() => { tickShipments(); console.log('[Server] Started'); });

// ── REST API ──────────────────────────────────────────────────────────────────
app.get('/api/shipments', (req, res) => res.json(shipments));

app.get('/api/shipments/:id/routes', (req, res) => {
  const s = shipments.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(generateRoutes(s, globalEnv));
});

app.get('/api/env', (req, res) => res.json(globalEnv));

app.get('/api/insights/:origin/:dest', (req, res) => {
  res.json(buildInsights(req.params.origin, req.params.dest, globalEnv.weatherData, globalEnv.trafficData));
});

// ── Route Planning ────────────────────────────────────────────────────────────
app.post('/api/route/plan', async (req, res) => {
  const { from, to, fromPlaceId, toPlaceId } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  try {
    const [originGeo, destGeo] = await Promise.all([
      geocodePlace(from, fromPlaceId || null),
      geocodePlace(to,   toPlaceId   || null),
    ]);

    if (!originGeo) return res.status(400).json({ error: `Could not find: "${from}". Please select from dropdown.` });
    if (!destGeo)   return res.status(400).json({ error: `Could not find: "${to}". Please select from dropdown.` });

    const oPid = originGeo.placeId || fromPlaceId || null;
    const dPid = destGeo.placeId   || toPlaceId   || null;

    const [weatherData, trafficData, directionsData, trainRoutes] = await Promise.all([
      fetchWeather(originGeo.lat, originGeo.lng),
      fetchTraffic(originGeo.lat, originGeo.lng, destGeo.lat, destGeo.lng, oPid, dPid),
      fetchOSRMRoute(originGeo.lat, originGeo.lng, destGeo.lat, destGeo.lng),
      buildTrainRoute(
        { lat: originGeo.lat, lng: originGeo.lng },
        { lat: destGeo.lat,   lng: destGeo.lng },
        originGeo.name || from,
        destGeo.name   || to
      ),
    ]);

    // Record traffic for learning
    recordTraffic(originGeo.lat, originGeo.lng, trafficData.congestion);

    const forecastWorst = worstForecastCondition(weatherData.forecast || []);
    const env = { traffic: trafficData.congestion, weather: weatherData.condition, forecastWorst, weatherData, trafficData, directionsData, trainRoutes };

    const virtualShipment = {
      id: 'PLAN',
      origin: originGeo.name || from,
      destination: destGeo.name || to,
      originCoords: { lat: originGeo.lat, lng: originGeo.lng },
      destCoords:   { lat: destGeo.lat,   lng: destGeo.lng },
      currentLocation: { lat: originGeo.lat, lng: originGeo.lng },
      progress: 0,
    };

    const routes   = generateRoutes(virtualShipment, env);
    const alerts   = buildAlerts(weatherData, trafficData, forecastWorst);
    const insights = buildInsights(originGeo.name || from, destGeo.name || to, weatherData, trafficData);
    const distKm = directionsData?.[0]?.distanceKm || trafficData.distanceKm || Math.round(haversineKm(originGeo, destGeo));
    const nextHoursPrediction = predictNextHours(originGeo.lat, originGeo.lng, 3);

    res.json({
      origin: originGeo, destination: destGeo,
      distKm,
      routes, weatherData, trafficData, directionsData,
      trainRoutes, forecastWorst, alerts, insights,
      nextHoursPrediction,
      bestRoute: routes.find(r => r.recommended),
    });
  } catch (e) {
    console.error('[route/plan]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Autocomplete ──────────────────────────────────────────────────────────────
app.get('/api/autocomplete', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  res.json(await getAutocompleteSuggestions(q));
});

// ── Traffic history ───────────────────────────────────────────────────────────
app.get('/api/traffic-history', (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
  res.json({
    pattern: getTrafficPattern(parseFloat(lat), parseFloat(lng)),
    nextHours: predictNextHours(parseFloat(lat), parseFloat(lng), 6),
  });
});

// ── Switch route ──────────────────────────────────────────────────────────────
app.post('/api/shipments/:id/switch-route', (req, res) => {
  const { routeId } = req.body;
  const idx = shipments.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const routes = generateRoutes(shipments[idx], globalEnv);
  const chosen = routes.find(r => r.id === routeId);
  if (!chosen) return res.status(400).json({ error: 'Invalid route' });
  shipments[idx] = { ...shipments[idx], currentMode: chosen.modes[0], eta: chosen.eta, riskScore: chosen.risk, autoSwitched: false, autoSwitchReason: null };
  res.json(shipments[idx]);
});

app.post('/api/refresh', async (req, res) => {
  await refreshGlobalEnv();
  res.json({ ok: true, env: globalEnv });
});

// ── Weather proxy — used by client weatherService for route-point queries ─────
// Optional ?eta=<unix_ms> triggers ETA-matched forecast lookup instead of current weather.
app.get('/api/weather', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const eta = req.query.eta ? parseInt(req.query.eta, 10) : null;

  if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'lat and lng required' });

  try {
    const data = eta ? await fetchWeatherWithEta(lat, lng, eta) : await fetchWeather(lat, lng);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

io.on('connection', socket => socket.emit('update', { shipments, env: globalEnv }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`[Server] Running on :${PORT}`));
