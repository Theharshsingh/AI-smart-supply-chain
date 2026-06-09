/**
 * routeScorer.js
 * Composite Route Score = 0.40 × NormTime + 0.35 × NormWeather + 0.25 × NormTraffic
 * Lower score = better route.
 */

import { formatDuration } from './etaCalculator';

const W_TIME    = 0.40;
const W_WEATHER = 0.35;
const W_TRAFFIC = 0.25;

function normalize(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0);
  return values.map(v => (v - min) / (max - min));
}

function routeLabel(analysis, isBest) {
  const { wxScore, trafScore } = analysis;
  if (!isBest) {
    if (wxScore.highCount > 0 && trafScore.maxCongestion >= 60) return 'Avoid: Risk + Heavy Traffic';
    if (wxScore.highCount > 0)  return 'Avoid: High Weather Risk';
    if (trafScore.maxCongestion >= 60) return 'Avoid: Heavy Traffic';
    if (wxScore.mediumCount > 0) return 'Moderate Risk Route';
    return 'Alternative Route';
  }
  if (trafScore.avgCongestion < 20 && wxScore.totalScore === 0) return '🚀 Fastest & Clear Route';
  if (wxScore.totalScore === 0)  return '✅ Safest Weather Route';
  if (trafScore.avgCongestion < 30) return '🌦 Best Overall Route';
  return '⚖ Balanced Route';
}

/**
 * Score and rank all route analyses.
 * Returns enriched analyses + best route recommendation.
 *
 * @param {Array<RouteAnalysis>} analyses  – output of analyzeRoutes()
 * @param {number} currentIdx
 */
export function scoreRoutes(analyses, currentIdx = 0) {
  if (!analyses?.length) return { scoredAnalyses: [], recommended: 0, reason: '', timeDiffMin: null };

  if (analyses.length === 1) {
    const a = analyses[0];
    return {
      scoredAnalyses: [{ ...a, compositeScore: 0, compositeScorePct: 0, recommendation: routeLabel(a, true) }],
      recommended:    0,
      reason:         'Only one route available.',
      timeDiffMin:    null,
      riskImprovement: null,
    };
  }

  const times   = analyses.map(a => a.adjustedDurationMin || a.durationMin || 0);
  const weather = analyses.map(a => a.rawWeatherScore    || 0);
  const traffic = analyses.map(a => a.rawTrafficScore    || 0);

  const normT = normalize(times);
  const normW = normalize(weather);
  const normTr = normalize(traffic);

  const scored = analyses.map((a, i) => {
    const composite = W_TIME * normT[i] + W_WEATHER * normW[i] + W_TRAFFIC * normTr[i];
    return {
      ...a,
      compositeScore:    parseFloat(composite.toFixed(4)),
      compositeScorePct: Math.round(composite * 100),
    };
  });

  // Lowest composite wins
  const bestIdx = scored.reduce((bi, a, i) => a.compositeScore < scored[bi].compositeScore ? i : bi, 0);
  scored.forEach((a, i) => { a.recommendation = routeLabel(a, i === bestIdx); });

  const best    = scored[bestIdx];
  const current = scored[currentIdx] || scored[0];
  const timeDiff = (best.durationMin || 0) - (current.durationMin || 0);

  const parts = [];
  if (best.trafScore.avgCongestion < current.trafScore.avgCongestion)
    parts.push(`${current.trafScore.avgCongestion - best.trafScore.avgCongestion}% less congestion`);
  if (best.wxScore.highCount < current.wxScore.highCount)
    parts.push(`avoids ${current.wxScore.highCount - best.wxScore.highCount} high-risk weather segment(s)`);
  if (timeDiff < 0) parts.push(`saves ${formatDuration(Math.abs(timeDiff))}`);
  else if (timeDiff > 0) parts.push(`adds ${formatDuration(timeDiff)}`);

  const reason = parts.length
    ? `Route ${best.routeIndex + 1}: ${parts.join(' · ')}`
    : `Route ${best.routeIndex + 1} has the best combined score`;

  const scoreDiff = current.compositeScorePct - best.compositeScorePct;

  return {
    scoredAnalyses:  scored,
    recommended:     best.routeIndex,
    reason,
    timeDiffMin:     timeDiff,
    riskImprovement: scoreDiff > 0 ? `${scoreDiff}pt better score` : null,
    improvementPct:  scoreDiff,
  };
}
