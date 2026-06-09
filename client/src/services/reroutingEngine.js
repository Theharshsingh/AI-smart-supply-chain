/**
 * reroutingEngine.js
 *
 * Composite Route Score = 0.40 × (NormTime) + 0.35 × (NormWeatherRisk) + 0.25 × (NormSafety)
 * Lower score = better route.
 *
 * Weather Risk Score: numerical sum from riskEngine (spec values)
 * Safety Risk: high-risk segment count × 15 + medium × 5 + speed reduction penalty
 * Adjusted ETA: durationMin × (1 + avgSpeedReduction)
 */

import { sampleRoutePoints } from './routeProcessor';
import { fetchWeatherForRoute } from './weatherService';
import { addEtaTimestamps, formatDuration } from './etaCalculator';
import { classifyRisk, routeWeatherScore } from './riskEngine';

// Weights per spec
const W_TIME    = 0.40;
const W_WEATHER = 0.35;
const W_SAFETY  = 0.25;

/**
 * Analyse weather risk for every alternative OSRM route in parallel.
 */
export async function analyzeRoutes(routes, departureTime = Date.now()) {
  if (!routes?.length) return [];

  const analyses = await Promise.all(
    routes.map(async (route, idx) => {
      try {
        const durationMs = (route.durationMin || 0) * 60 * 1000;
        const sampled    = sampleRoutePoints(route.polyline, durationMs, 10, 15);
        const withEta    = addEtaTimestamps(sampled, departureTime);
        const wxPoints   = await fetchWeatherForRoute(withEta, 3);

        // Enrich with risk classification
        const enriched = wxPoints.map(pt => ({ ...pt, riskInfo: classifyRisk(pt.weather) }));
        const score    = routeWeatherScore(enriched);

        // Adjusted ETA based on weather-induced speed reductions
        const adjustedDurationMin = Math.round(
          (route.durationMin || 0) * (1 + score.avgSpeedReduction)
        );

        // Safety score: weighted by segment severity
        const safetyScore = (score.highCount * 15) + (score.mediumCount * 5) +
          (score.lightCount * 1) + Math.round(score.avgSpeedReduction * 50);

        return {
          routeIndex:         idx,
          durationMin:        route.durationMin,
          distanceKm:         route.distanceKm,
          adjustedDurationMin,
          weatherPoints:      enriched,
          weatherScore:       score,
          safetyScore,
          rawWeatherScore:    score.totalScore,
        };
      } catch {
        return {
          routeIndex:         idx,
          durationMin:        route.durationMin,
          distanceKm:         route.distanceKm,
          adjustedDurationMin: route.durationMin,
          weatherPoints:      [],
          weatherScore:       { totalScore: 999, highCount: 0, mediumCount: 0, lightCount: 0, maxLevel: 'safe', avgSpeedReduction: 0 },
          safetyScore:        999,
          rawWeatherScore:    999,
        };
      }
    })
  );

  return analyses;
}

/**
 * Normalize array of numbers to [0, 1]. If all equal → all 0.5.
 */
function normalize(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map(v => (v - min) / (max - min));
}

/**
 * Compute composite route scores and pick the best route.
 * Returns enriched analyses with `compositeScore` and recommendation label.
 */
export function getBestRoute(analyses, currentIdx = 0) {
  if (!analyses?.length) return { recommended: 0, reason: '', timeDiffMin: null, riskImprovement: null, scoredAnalyses: analyses };

  if (analyses.length === 1) {
    const single = analyses[0];
    const label  = _routeLabel(single);
    return {
      recommended:    0,
      reason:         'Only one route available.',
      timeDiffMin:    null,
      riskImprovement: null,
      scoredAnalyses: [{ ...single, compositeScore: 0, recommendation: label }],
    };
  }

  // Normalize the three dimensions
  const times   = analyses.map(a => a.adjustedDurationMin || a.durationMin || 0);
  const weather = analyses.map(a => a.rawWeatherScore    || 0);
  const safety  = analyses.map(a => a.safetyScore        || 0);

  const normTimes   = normalize(times);
  const normWeather = normalize(weather);
  const normSafety  = normalize(safety);

  const scored = analyses.map((a, i) => ({
    ...a,
    compositeScore: parseFloat(
      (W_TIME * normTimes[i] + W_WEATHER * normWeather[i] + W_SAFETY * normSafety[i]).toFixed(4)
    ),
    recommendation: null, // assigned below
  }));

  // Lowest composite score wins
  const bestIdx = scored.reduce((bi, a, i) => a.compositeScore < scored[bi].compositeScore ? i : bi, 0);

  // Assign recommendation labels
  scored.forEach((a, i) => { a.recommendation = _routeLabel(a, i === bestIdx); });

  const best    = scored[bestIdx];
  const current = scored[currentIdx] || scored[0];

  if (bestIdx === currentIdx) {
    return {
      recommended:     currentIdx,
      reason:          'Your current route has the best overall score.',
      timeDiffMin:     null,
      riskImprovement: null,
      scoredAnalyses:  scored,
    };
  }

  const timeDiff    = (best.durationMin || 0) - (current.durationMin || 0);
  const scoreDiff   = current.weatherScore.totalScore - best.weatherScore.totalScore;
  const parts       = [];

  if (best.weatherScore.highCount < current.weatherScore.highCount)
    parts.push(`avoids ${current.weatherScore.highCount - best.weatherScore.highCount} high-risk segment(s)`);
  else if (best.weatherScore.mediumCount < current.weatherScore.mediumCount)
    parts.push(`avoids ${current.weatherScore.mediumCount - best.weatherScore.mediumCount} moderate-risk segment(s)`);

  if (timeDiff < 0) parts.push(`saves ${formatDuration(Math.abs(timeDiff))}`);
  else if (timeDiff > 0) parts.push(`adds ${formatDuration(timeDiff)} travel time`);

  const reason = parts.length
    ? `Route ${best.routeIndex + 1} ${parts.join(' and ')}`
    : `Route ${best.routeIndex + 1} has the best weather-adjusted score`;

  return {
    recommended:     best.routeIndex,
    reason,
    timeDiffMin:     timeDiff,
    riskImprovement: scoreDiff > 0 ? `${scoreDiff} point weather improvement` : null,
    scoredAnalyses:  scored,
  };
}

function _routeLabel(analysis, isBest = false) {
  const { weatherScore, adjustedDurationMin, durationMin } = analysis;
  const delay = adjustedDurationMin - durationMin;

  if (weatherScore.highCount > 0)   return isBest ? 'Safest Route' : 'Avoid: High Risk Ahead';
  if (weatherScore.mediumCount > 0) return isBest ? 'Balanced Route' : 'Moderate Weather Risk';
  if (weatherScore.totalScore === 0) return isBest ? 'Fastest Route' : 'Clear Route';
  return isBest ? 'Recommended' : `+${delay > 0 ? delay : 0} min adjusted`;
}
