/**
 * routeAnalyzer.js
 * Combines TomTom traffic + Open-Meteo weather per route segment.
 * Computes:
 *   - Per-segment combined risk
 *   - Adjusted ETA (traffic + weather speed reductions)
 *   - Traffic delay minutes
 *   - Weather delay minutes
 */

import { sampleRoutePoints, totalRouteKm } from './routeProcessor';
import { addEtaTimestamps } from './etaCalculator';
import { fetchWeatherForRoute } from './weatherService';
import { fetchTrafficForRoute, speedReductionFromCongestion, routeTrafficScore } from './trafficService';
import { classifyRisk, routeWeatherScore } from './riskEngine';

// Sample 1 point every ~3 km for routes ≤100km, every ~10km for longer routes
function getSampleParams(totalKm) {
  if (totalKm <= 50)   return { maxPoints: 12, minDistKm: 3 };
  if (totalKm <= 200)  return { maxPoints: 14, minDistKm: 5 };
  if (totalKm <= 500)  return { maxPoints: 16, minDistKm: 8 };
  return                      { maxPoints: 18, minDistKm: 15 };
}

/**
 * Fully analyze a single route: sample → traffic → weather → combine.
 *
 * @param {{ polyline, durationMin, distanceKm }} route
 * @param {number} departureTime  Unix ms
 * @returns {Promise<RouteAnalysis>}
 */
export async function analyzeRoute(route, departureTime = Date.now()) {
  const durationMs = (route.durationMin || 0) * 60 * 1000;
  const totalKm    = totalRouteKm(route.polyline);
  const { maxPoints, minDistKm } = getSampleParams(totalKm);

  // 1. Sample evenly-spaced points
  const sampled = sampleRoutePoints(route.polyline, durationMs, maxPoints, minDistKm);

  // 2. Add absolute ETA timestamps (departure + relative offset)
  const withEta = addEtaTimestamps(sampled, departureTime);

  // 3. Fetch traffic + weather in parallel
  const [trafficPts, weatherPts] = await Promise.all([
    fetchTrafficForRoute(withEta),
    fetchWeatherForRoute(withEta),
  ]);

  // 4. Merge traffic + weather per point
  const segments = withEta.map((pt, i) => {
    const traffic = trafficPts[i]?.traffic  || null;
    const weather = weatherPts[i]?.weather  || null;
    const wxRisk  = classifyRisk(weather);

    // Combined speed reduction
    const wxReduce  = wxRisk.speedReduction || 0;
    const trafReduce = traffic ? speedReductionFromCongestion(traffic.congestionPct) : 0;
    // Cap at 70% — can't reduce to standstill
    const combined  = Math.min(0.70, wxReduce + trafReduce);

    return {
      ...pt,
      traffic,
      weather,
      wxRisk,
      speedReduction: combined,
      congestionPct:  traffic?.congestionPct ?? 0,
      trafficRisk:    traffic?.riskScore     ?? 0,
      weatherRisk:    wxRisk.numericScore    ?? 0,
    };
  });

  // 5. Compute aggregates
  const wxScore  = routeWeatherScore(segments.map(s => ({ ...s, riskInfo: s.wxRisk })));
  const trafScore = routeTrafficScore(segments);

  // Adjusted duration: for each segment, scale by (1 + speedReduction)
  // Weighted by segment length fraction
  let adjustedDurationMin = route.durationMin || 0;
  if (segments.length > 1) {
    const totalWeight = segments.reduce((s, seg) => s + (seg.distFromStartKm || 0), 0) || 1;
    const weightedReduction = segments.reduce((s, seg) => {
      const w = (seg.distFromStartKm || 0) / totalWeight;
      return s + seg.speedReduction * w;
    }, 0);
    adjustedDurationMin = Math.round(route.durationMin * (1 + weightedReduction));
  }

  const trafficDelayMin = Math.max(0, Math.round(
    (trafScore.avgCongestion / 100) * (route.durationMin || 0) * 0.6
  ));
  const weatherDelayMin = Math.max(0, adjustedDurationMin - route.durationMin - trafficDelayMin);

  return {
    routeIndex:       route.routeIndex ?? 0,
    durationMin:      route.durationMin,
    distanceKm:       route.distanceKm,
    adjustedDurationMin,
    trafficDelayMin,
    weatherDelayMin,
    segments,
    wxScore,
    trafScore,
    // raw scores for composite formula
    rawWeatherScore:  wxScore.totalScore,
    rawTrafficScore:  trafScore.totalRisk,
    safetyScore:      (wxScore.highCount * 15) + (wxScore.mediumCount * 5) + (trafScore.avgRisk * 0.3),
  };
}

/**
 * Analyze all alternative routes in parallel.
 */
export async function analyzeRoutes(routes, departureTime = Date.now()) {
  if (!routes?.length) return [];

  return Promise.all(
    routes.map((route, idx) =>
      analyzeRoute({ ...route, routeIndex: idx }, departureTime).catch(() => ({
        routeIndex: idx,
        durationMin:        route.durationMin,
        distanceKm:         route.distanceKm,
        adjustedDurationMin: route.durationMin,
        trafficDelayMin:    0,
        weatherDelayMin:    0,
        segments:           [],
        wxScore:            { totalScore: 0, highCount: 0, mediumCount: 0, lightCount: 0, maxLevel: 'safe', avgSpeedReduction: 0 },
        trafScore:          { avgCongestion: 0, maxCongestion: 0, totalRisk: 0, avgRisk: 0 },
        rawWeatherScore:    0,
        rawTrafficScore:    0,
        safetyScore:        0,
      }))
    )
  );
}
