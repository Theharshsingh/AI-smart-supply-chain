/**
 * trafficService.js
 * TomTom Traffic Flow API integration.
 * Fetches live speed/freeflow per segment → congestion % → traffic risk score.
 *
 * Congestion % = ((freeFlowSpeed - currentSpeed) / freeFlowSpeed) × 100
 *
 * Traffic Risk Score:
 *   0–20%  → 0    (green)
 *   20–40% → 25   (yellow)
 *   40–60% → 50   (orange)
 *   60–80% → 75   (red)
 *   80–100%→ 100  (dark red)
 */

const TOMTOM_KEY = 'iGUBpK2z46b095uHc02QCBFC45jZL6u9';
const FLOW_URL   = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';

// In-memory cache — key: "lat2,lng2", TTL: 3 min (traffic changes fast)
const _cache = new Map();
const TTL_MS  = 3 * 60 * 1000;

function cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { _cache.delete(key); return null; }
  return e.val;
}
function cacheSet(key, val) {
  _cache.set(key, { val, exp: Date.now() + TTL_MS });
}

/**
 * Traffic color per congestion %
 * Green / Yellow / Orange / Red / DarkRed
 */
export function congestionColor(pct) {
  if (pct >= 80) return '#7f1d1d'; // dark red
  if (pct >= 60) return '#ef4444'; // red
  if (pct >= 40) return '#f97316'; // orange
  if (pct >= 20) return '#eab308'; // yellow
  return '#22c55e';                 // green
}

/**
 * Traffic risk score from congestion %
 */
export function trafficRiskScore(congestionPct) {
  if (congestionPct >= 80) return 100;
  if (congestionPct >= 60) return 75;
  if (congestionPct >= 40) return 50;
  if (congestionPct >= 20) return 25;
  return 0;
}

/**
 * Speed reduction factor from congestion %
 * Used to adjust ETA.
 */
export function speedReductionFromCongestion(congestionPct) {
  if (congestionPct >= 80) return 0.60;
  if (congestionPct >= 60) return 0.40;
  if (congestionPct >= 40) return 0.25;
  if (congestionPct >= 20) return 0.10;
  return 0;
}

/**
 * Fetch TomTom flow data for a single lat/lng.
 * Returns { currentSpeed, freeFlowSpeed, congestionPct, riskScore, color, travelTimeRatio, source }
 */
export async function fetchTrafficFlow(lat, lng) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    const url = `${FLOW_URL}?key=${TOMTOM_KEY}&point=${lat},${lng}&unit=KMPH&openLr=false`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`TomTom HTTP ${res.status}`);
    const data = await res.json();
    const fd   = data.flowSegmentData;
    if (!fd) throw new Error('no flowSegmentData');

    const currentSpeed  = Math.round(fd.currentSpeed  ?? 0);
    const freeFlowSpeed = Math.round(fd.freeFlowSpeed ?? currentSpeed ?? 50);
    const travelTime    = fd.currentTravelTime  ?? null;
    const freeFlowTime  = fd.freeFlowTravelTime ?? null;

    const congestionPct = freeFlowSpeed > 0
      ? Math.round(Math.max(0, Math.min(100, ((freeFlowSpeed - currentSpeed) / freeFlowSpeed) * 100)))
      : 0;

    const travelTimeRatio = (freeFlowTime && travelTime)
      ? parseFloat((travelTime / freeFlowTime).toFixed(2))
      : 1.0;

    const result = {
      currentSpeed,
      freeFlowSpeed,
      congestionPct,
      riskScore:        trafficRiskScore(congestionPct),
      color:            congestionColor(congestionPct),
      travelTimeRatio,
      travelTime,
      freeFlowTime,
      source:           'tomtom',
    };

    cacheSet(key, result);
    return result;
  } catch (err) {
    // Graceful fallback — heuristic based on time of day
    const hour = new Date().getHours();
    const isPeak = (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20);
    const congestionPct = isPeak ? 45 : 15;
    return {
      currentSpeed:   isPeak ? 30 : 55,
      freeFlowSpeed:  60,
      congestionPct,
      riskScore:      trafficRiskScore(congestionPct),
      color:          congestionColor(congestionPct),
      travelTimeRatio: isPeak ? 1.5 : 1.1,
      travelTime:     null,
      freeFlowTime:   null,
      source:         'heuristic',
    };
  }
}

/**
 * Fetch traffic for all sampled route points with controlled concurrency.
 * Batches of 3 with 200ms gap to avoid rate-limiting.
 *
 * @param {Array<{lat, lng, distFromStartKm, etaMs}>} points
 * @returns {Promise<Array<{...point, traffic: TrafficData}>>}
 */
export async function fetchTrafficForRoute(points, concurrency = 3) {
  if (!points?.length) return [];
  const results = [];

  for (let i = 0; i < points.length; i += concurrency) {
    const chunk = points.slice(i, i + concurrency);
    const batch = await Promise.all(
      chunk.map(pt =>
        fetchTrafficFlow(pt.lat, pt.lng).then(traffic => ({ ...pt, traffic }))
      )
    );
    results.push(...batch);
    if (i + concurrency < points.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}

/**
 * Aggregate traffic score for a whole route.
 */
export function routeTrafficScore(trafficPoints) {
  if (!trafficPoints?.length) return { avgCongestion: 0, maxCongestion: 0, totalRisk: 0, avgRisk: 0 };
  const pts = trafficPoints.filter(p => p.traffic);
  if (!pts.length) return { avgCongestion: 0, maxCongestion: 0, totalRisk: 0, avgRisk: 0 };

  const totalCongestion = pts.reduce((s, p) => s + (p.traffic.congestionPct || 0), 0);
  const maxCongestion   = Math.max(...pts.map(p => p.traffic.congestionPct || 0));
  const totalRisk       = pts.reduce((s, p) => s + (p.traffic.riskScore || 0), 0);

  return {
    avgCongestion: Math.round(totalCongestion / pts.length),
    maxCongestion,
    totalRisk,
    avgRisk:       Math.round(totalRisk / pts.length),
  };
}
