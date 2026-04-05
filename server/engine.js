const { getHistoricalData } = require('./data');
const { predictCongestion, predictNextHours } = require('./trafficLearning');

const WEATHER_RISK = { Clear: 0.05, Cloudy: 0.10, Rain: 0.45, Fog: 0.55, Storm: 0.90 };
const MODE_SPEED   = { ROAD: 60, TRAIN: 80, AIR: 800 };

function haversineKm(a, b) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function calculateRisk(traffic, weather, origin, dest, forecastWorst = 'Clear', lat = null, lng = null) {
  const hist = getHistoricalData(origin, dest);
  const hour = new Date().getHours();
  const isPeak = hist.peakHours.includes(hour);

  // Blend live traffic with learned prediction
  let effectiveTraffic = traffic;
  if (lat && lng) {
    const pred = predictCongestion(lat, lng);
    if (pred.source === 'learned') {
      effectiveTraffic = traffic * 0.6 + pred.predicted * 0.4;
    }
  }

  const trafficFactor = Math.min(1, effectiveTraffic + (isPeak ? 0.1 : 0));
  const worstW = (WEATHER_RISK[forecastWorst] || 0) > (WEATHER_RISK[weather] || 0) ? forecastWorst : weather;
  const weatherFactor = WEATHER_RISK[worstW] || 0.05;
  const delayFactor = hist.avgDelay + (isPeak ? 0.1 : 0);
  return Math.min(1, trafficFactor * 0.5 + weatherFactor * 0.3 + delayFactor * 0.2);
}

function buildReasons(traffic, weather, forecastWorst, trafficData, lat, lng) {
  const r = [];
  if (traffic > 0.7) r.push(`Live congestion: ${Math.round(traffic * 100)}%`);
  else if (traffic > 0.4) r.push(`Moderate traffic: ${Math.round(traffic * 100)}%`);
  if (weather === 'Storm') r.push('Active storm on route');
  else if (weather === 'Rain') r.push('Rain reducing road visibility');
  else if (weather === 'Fog') r.push('Fog causing slowdowns');
  if (forecastWorst !== 'Clear' && forecastWorst !== weather) r.push(`${forecastWorst} forecast in 3h`);
  if (trafficData?.source === 'google' && trafficData.durationTrafficMin > trafficData.durationMin)
    r.push(`+${trafficData.durationTrafficMin - trafficData.durationMin} min from live traffic`);
  if (lat && lng) {
    const nextHours = predictNextHours(lat, lng, 2);
    const highNext = nextHours.find(h => h.predicted > 0.65);
    if (highNext) r.push(`Heavy traffic predicted at ${highNext.hour}:00`);
  }
  if (!r.length) r.push('Route clear — normal conditions');
  return r;
}

function decideBest(traffic, weather, forecastWorst, distKm, trainRoute) {
  const worstW = (WEATHER_RISK[forecastWorst] || 0) > (WEATHER_RISK[weather] || 0) ? forecastWorst : weather;
  if (worstW === 'Storm' || traffic > 0.80) return 'C';
  // Prefer train if it's faster than road or distance > 300km
  if (trainRoute && (distKm > 300 || (traffic > 0.55 && (WEATHER_RISK[worstW] || 0) > 0.1))) return 'B';
  if (distKm > 800 || (traffic > 0.55 && (WEATHER_RISK[worstW] || 0) > 0.1)) return 'B';
  return 'A';
}

function generateRoutes(shipment, env) {
  const {
    traffic, weather, forecastWorst = 'Clear',
    trafficData = {}, directionsData = null, trainRoutes = null,
  } = env;

  const dist = haversineKm(shipment.originCoords, shipment.destCoords);
  const remaining = dist * (1 - (shipment.progress || 0));
  const oLat = shipment.originCoords?.lat, oLng = shipment.originCoords?.lng;
  const baseRisk = calculateRisk(traffic, weather, shipment.origin, shipment.destination, forecastWorst, oLat, oLng);

  // ── Route A: Road ──────────────────────────────────────────────────────────
  let roadEtaH, roadDistKm, roadPolyline = null, roadAlternatives = [];
  if (directionsData?.length > 0) {
    const best = directionsData[0];
    roadEtaH    = best.durationTrafficMin / 60;
    roadDistKm  = best.distanceKm;
    roadPolyline = best.polyline;
    roadAlternatives = directionsData.slice(1).map((r, i) => ({
      label: `Alt ${i + 1} via ${r.summary}`,
      etaMin: r.durationTrafficMin,
      distKm: r.distanceKm,
      polyline: r.polyline,
      congestionColor: r.durationTrafficMin / r.durationMin > 1.4 ? 'red' : r.durationTrafficMin / r.durationMin > 1.15 ? 'orange' : 'green',
    }));
  } else if (trafficData?.durationTrafficMin) {
    roadEtaH   = trafficData.durationTrafficMin / 60;
    roadDistKm = trafficData.distanceKm || Math.round(remaining);
  } else {
    roadEtaH   = remaining / (MODE_SPEED.ROAD * (1 - traffic * 0.4));
    roadDistKm = Math.round(remaining);
  }

  // Traffic color for road route
  const roadCongestionColor = traffic > 0.65 ? 'red' : traffic > 0.40 ? 'orange' : 'green';

  // ── Route B: Road + Train (intelligent) ───────────────────────────────────
  let trainRoute = null, trainEtaH, trainDistKm, trainSegments, trainReasons;
  if (trainRoutes && trainRoutes.length > 0) {
    trainRoute = trainRoutes[0];
    trainEtaH  = trainRoute.totalH;
    trainDistKm = (trainRoute.steps.reduce((s, st) => s + (st.distKm || 0), 0));
    trainSegments = trainRoute.steps;
    trainReasons = [
      `Board ${trainRoute.train.trainName} at ${trainRoute.train.departure}`,
      `Arrive ${trainRoute.destStation.name} at ${trainRoute.train.arrival}`,
      'Train bypasses all road congestion',
    ];
  } else {
    trainEtaH   = remaining * 0.2 / MODE_SPEED.ROAD + remaining * 0.65 / MODE_SPEED.TRAIN + remaining * 0.15 / MODE_SPEED.ROAD;
    trainDistKm = Math.round(remaining);
    trainSegments = [
      { step: 1, mode: 'ROAD',  from: shipment.origin,      to: 'Nearest Rail Station', distKm: Math.round(remaining * 0.2), durationMin: Math.round(remaining * 0.2 / MODE_SPEED.ROAD * 60), instruction: `Drive to nearest railway station` },
      { step: 2, mode: 'TRAIN', from: 'Origin Station',     to: 'Dest Station',          distKm: Math.round(remaining * 0.65), durationMin: Math.round(remaining * 0.65 / MODE_SPEED.TRAIN * 60), instruction: `Take express train` },
      { step: 3, mode: 'ROAD',  from: 'Dest Station',       to: shipment.destination,    distKm: Math.round(remaining * 0.15), durationMin: Math.round(remaining * 0.15 / MODE_SPEED.ROAD * 60), instruction: `Drive to destination` },
    ];
    trainReasons = ['Bypasses road congestion', 'Train unaffected by traffic', 'Stable in rain/fog'];
  }

  // ── Route C: Road + Air ────────────────────────────────────────────────────
  const airEtaH = remaining * 0.1 / MODE_SPEED.ROAD + remaining * 0.8 / MODE_SPEED.AIR + remaining * 0.1 / MODE_SPEED.ROAD + 2;

  const routes = [
    {
      id: 'A',
      label: 'Road Only',
      modes: ['ROAD'],
      segments: [{ mode: 'ROAD', from: shipment.origin, to: shipment.destination, distKm: roadDistKm || Math.round(remaining) }],
      steps: [{ step: 1, mode: 'ROAD', from: shipment.origin, to: shipment.destination, distKm: roadDistKm, durationMin: Math.round(roadEtaH * 60), instruction: `Drive via fastest road route` }],
      eta: Math.ceil(roadEtaH),
      etaMin: Math.round(roadEtaH * 60),
      risk: Math.round(baseRisk * 100),
      distKm: roadDistKm || Math.round(remaining),
      reasons: buildReasons(traffic, weather, forecastWorst, trafficData, oLat, oLng),
      polyline: roadPolyline,
      alternatives: roadAlternatives,
      congestionColor: roadCongestionColor,
      recommended: false,
    },
    {
      id: 'B',
      label: trainRoute ? `Road + ${trainRoute.train.trainName}` : 'Road + Train',
      modes: ['ROAD', 'TRAIN'],
      segments: trainSegments,
      steps: trainSegments,
      eta: Math.ceil(trainEtaH),
      etaMin: Math.round(trainEtaH * 60),
      risk: Math.round(baseRisk * 0.50 * 100),
      distKm: trainDistKm,
      reasons: trainReasons,
      polyline: null,
      alternatives: [],
      congestionColor: 'green',
      trainInfo: trainRoute ? {
        trainNo: trainRoute.train.trainNo,
        trainName: trainRoute.train.trainName,
        departure: trainRoute.train.departure,
        arrival: trainRoute.train.arrival,
        fromStation: trainRoute.originStation.name,
        toStation: trainRoute.destStation.name,
        bufferMin: 20,
      } : null,
      recommended: false,
    },
    {
      id: 'C',
      label: 'Road + Air',
      modes: ['ROAD', 'AIR'],
      segments: [
        { step: 1, mode: 'ROAD', from: shipment.origin,    to: 'Airport',      distKm: Math.round(remaining * 0.1), durationMin: Math.round(remaining * 0.1 / MODE_SPEED.ROAD * 60), instruction: 'Drive to nearest airport' },
        { step: 2, mode: 'AIR',  from: 'Origin Airport',   to: 'Dest Airport', distKm: Math.round(remaining * 0.8), durationMin: Math.round(remaining * 0.8 / MODE_SPEED.AIR * 60 + 120), instruction: 'Fly to destination city' },
        { step: 3, mode: 'ROAD', from: 'Dest Airport',     to: shipment.destination, distKm: Math.round(remaining * 0.1), durationMin: Math.round(remaining * 0.1 / MODE_SPEED.ROAD * 60), instruction: 'Drive to final destination' },
      ],
      steps: [],
      eta: Math.ceil(airEtaH),
      etaMin: Math.round(airEtaH * 60),
      risk: Math.round(baseRisk * 0.22 * 100),
      distKm: Math.round(remaining),
      reasons: ['Fastest option', 'Avoids all road traffic', 'Minimal weather impact'],
      polyline: null,
      alternatives: [],
      congestionColor: 'green',
      recommended: false,
    },
  ];

  routes.find(r => r.id === decideBest(traffic, weather, forecastWorst, dist, trainRoute)).recommended = true;
  return routes;
}

module.exports = { generateRoutes, calculateRisk, haversineKm, WEATHER_RISK };
