// In-memory traffic learning store
// Keyed by "lat_lng_hour" → array of congestion readings
const trafficStore = {};
const MAX_READINGS = 50; // keep last 50 per slot

// Round coords to ~1km grid for grouping
function gridKey(lat, lng, hour) {
  return `${(lat).toFixed(2)}_${(lng).toFixed(2)}_${hour}`;
}

function recordTraffic(lat, lng, congestion) {
  const hour = new Date().getHours();
  const key = gridKey(lat, lng, hour);
  if (!trafficStore[key]) trafficStore[key] = [];
  trafficStore[key].push({ congestion, ts: Date.now() });
  if (trafficStore[key].length > MAX_READINGS) trafficStore[key].shift();
}

// Predict congestion for a location at a given hour (default = current hour)
function predictCongestion(lat, lng, hour = null) {
  const h = hour ?? new Date().getHours();
  const key = gridKey(lat, lng, h);
  const readings = trafficStore[key];
  if (readings && readings.length >= 3) {
    const avg = readings.reduce((s, r) => s + r.congestion, 0) / readings.length;
    return { predicted: parseFloat(avg.toFixed(2)), confidence: Math.min(1, readings.length / 20), source: 'learned' };
  }
  // Fallback: time-of-day heuristic
  const isPeakMorning = h >= 7 && h <= 9;
  const isPeakEvening = h >= 17 && h <= 20;
  const isNight = h >= 22 || h <= 5;
  const base = isPeakMorning || isPeakEvening ? 0.65 : isNight ? 0.10 : 0.28;
  return { predicted: base, confidence: 0.3, source: 'heuristic' };
}

// Get traffic pattern summary for a route (for insights)
function getTrafficPattern(lat, lng) {
  const patterns = [];
  for (let h = 0; h < 24; h++) {
    const key = gridKey(lat, lng, h);
    const readings = trafficStore[key];
    if (readings && readings.length > 0) {
      const avg = readings.reduce((s, r) => s + r.congestion, 0) / readings.length;
      patterns.push({ hour: h, avgCongestion: parseFloat(avg.toFixed(2)), readings: readings.length });
    }
  }
  return patterns;
}

// Predict next N hours congestion
function predictNextHours(lat, lng, n = 3) {
  const now = new Date().getHours();
  return Array.from({ length: n }, (_, i) => {
    const h = (now + i + 1) % 24;
    const pred = predictCongestion(lat, lng, h);
    return { hour: h, ...pred };
  });
}

module.exports = { recordTraffic, predictCongestion, getTrafficPattern, predictNextHours };
