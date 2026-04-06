/**
 * reroutingEngine.js
 * Analyses all available route alternatives in parallel,
 * scores each by weather risk, and recommends the best option.
 */

import { sampleRoutePoints } from './routeProcessor';
import { fetchWeatherForRoute } from './weatherService';
import { addEtaTimestamps, formatDuration } from './etaCalculator';
import { routeWeatherScore } from './riskEngine';

/**
 * Analyse weather risk for every alternative OSRM route.
 *
 * @param {Array<{polyline, durationMin, distanceKm, routeIndex}>} routes
 * @param {number} departureTime – Unix ms (default: now)
 * @returns {Promise<Array<{ routeIndex, durationMin, distanceKm, weatherPoints, weatherScore }>>}
 */
export async function analyzeRoutes(routes, departureTime = Date.now()) {
  if (!routes?.length) return [];

  // Run weather analysis on all routes in parallel
  const analyses = await Promise.all(
    routes.map(async (route, idx) => {
      try {
        const durationMs = (route.durationMin || 0) * 60 * 1000;
        const sampled    = sampleRoutePoints(route.polyline, durationMs, 10, 15);
        const withEta    = addEtaTimestamps(sampled, departureTime);
        const wxPoints   = await fetchWeatherForRoute(withEta, 3);
        const score      = routeWeatherScore(wxPoints);
        return {
          routeIndex:  idx,
          durationMin: route.durationMin,
          distanceKm:  route.distanceKm,
          weatherPoints: wxPoints,
          weatherScore: score,
        };
      } catch {
        return {
          routeIndex:  idx,
          durationMin: route.durationMin,
          distanceKm:  route.distanceKm,
          weatherPoints: [],
          weatherScore: { totalScore: 999, highCount: 0, mediumCount: 0, lightCount: 0, maxLevel: 'safe' },
        };
      }
    })
  );

  return analyses;
}

/**
 * Pick the best route from analysed alternatives.
 * Prefers lowest weather risk; tie-breaks on shortest duration.
 *
 * @param {Array} analyses – output of analyzeRoutes()
 * @param {number} currentIdx – index user has currently selected
 * @returns {{ recommended: number, reason: string, timeDiffMin: number|null, riskImprovement: string|null }}
 */
export function getBestRoute(analyses, currentIdx = 0) {
  if (!analyses?.length) return { recommended: 0, reason: '', timeDiffMin: null, riskImprovement: null };

  // Sort: lower totalScore first, then shorter duration
  const sorted = [...analyses].sort((a, b) => {
    const sd = a.weatherScore.totalScore - b.weatherScore.totalScore;
    if (sd !== 0) return sd;
    return (a.durationMin || 0) - (b.durationMin || 0);
  });

  const best    = sorted[0];
  const current = analyses[currentIdx] || analyses[0];

  if (best.routeIndex === currentIdx) {
    return { recommended: currentIdx, reason: 'Your current route has the best weather conditions.', timeDiffMin: null, riskImprovement: null };
  }

  const scoreDiff = current.weatherScore.totalScore - best.weatherScore.totalScore;
  const timeDiff  = (best.durationMin || 0) - (current.durationMin || 0);

  const parts = [];
  if (best.weatherScore.highCount < current.weatherScore.highCount)
    parts.push(`avoids ${current.weatherScore.highCount - best.weatherScore.highCount} high-risk segment(s)`);
  else if (best.weatherScore.mediumCount < current.weatherScore.mediumCount)
    parts.push(`avoids ${current.weatherScore.mediumCount - best.weatherScore.mediumCount} moderate-risk segment(s)`);

  if (timeDiff < 0) parts.push(`saves ${formatDuration(Math.abs(timeDiff))}`);
  else if (timeDiff > 0) parts.push(`adds ${formatDuration(timeDiff)}`);

  const reason = parts.length
    ? `Route ${best.routeIndex + 1} ${parts.join(' and ')}`
    : `Route ${best.routeIndex + 1} has better overall weather conditions`;

  return {
    recommended:     best.routeIndex,
    reason,
    timeDiffMin:     timeDiff,
    riskImprovement: scoreDiff > 0 ? `${scoreDiff} point improvement` : null,
  };
}
