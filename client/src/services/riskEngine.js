/**
 * riskEngine.js
 * Mathematical weather risk model per spec.
 *
 * Risk Score accumulates:
 *   Rain:         Light +10 | Moderate +25 | Heavy +50
 *   Thunderstorm: +70
 *   Wind:         20-40 +10 | 40-60 +25 | 60+ +50
 *   Visibility:   <5km +20 | <2km +40
 *   Gusts:        extra +10 if > wind threshold by 20+
 *
 * Levels:  0 = SAFE  |  1-24 = LIGHT  |  25-54 = MEDIUM  |  55+ = HIGH
 *
 * Traffic speed reduction (for ETA adjustment):
 *   Heavy Rain   -30%  |  Thunderstorm -50%  |  Poor Vis -25%  |  High Wind -20%
 */

export const RISK = {
  SAFE:   { key: 'safe',   label: 'Safe',        score: 0,  color: '#22c55e', darkBg: 'rgba(34,197,94,0.1)',   emoji: '✅' },
  LIGHT:  { key: 'light',  label: 'Light Risk',  score: 1,  color: '#84cc16', darkBg: 'rgba(132,204,22,0.1)',  emoji: '⚡' },
  MEDIUM: { key: 'medium', label: 'Moderate',    score: 25, color: '#f59e0b', darkBg: 'rgba(245,158,11,0.1)', emoji: '⚠️' },
  HIGH:   { key: 'high',   label: 'High Risk',   score: 55, color: '#ef4444', darkBg: 'rgba(239,68,68,0.1)',   emoji: '🚨' },
  SEVERE: { key: 'severe', label: 'Severe',      score: 70, color: '#7f1d1d', darkBg: 'rgba(127,29,29,0.15)',  emoji: '⛈️' },
};

/**
 * Compute numerical risk score (0-100+) from weather data.
 * @param {{ condition, description, windSpeed, windGusts, visibility, precipitation, precipProb }} wx
 * @returns {{ numericScore, level, key, color, label, emoji, darkBg, reasons, speedReduction }}
 */
export function classifyRisk(wx) {
  if (!wx) return { ...RISK.SAFE, numericScore: 0, reasons: [], speedReduction: 0 };

  const cond  = (wx.condition  || '').toLowerCase();
  const desc  = (wx.description || '').toLowerCase();
  const wind  = wx.windSpeed  || 0;   // km/h
  const gusts = wx.windGusts  || 0;   // km/h
  const vis   = wx.visibility;        // km or null
  const precip = wx.precipitation || 0; // mm
  const precipProb = wx.precipProb ?? wx.pop ?? 0; // %

  let score = 0;
  const reasons = [];

  // ── Thunderstorm ────────────────────────────────────────────────────────
  const isThunder = /thunderstorm|storm|squall|tornado/i.test(cond) || /thunderstorm|storm/i.test(desc);
  if (isThunder) {
    score += 70;
    reasons.push('⛈️ Thunderstorm conditions (+70)');
  }

  // ── Rain risk ────────────────────────────────────────────────────────────
  if (!isThunder) {
    const isHeavyRain = /heavy rain|violent rain|heavy shower|heavy drizzle/i.test(desc) || precip > 7.5;
    const isModRain   = /moderate rain|rain shower|moderate drizzle|sleet|snow/i.test(desc) || (precip > 2.5 && !isHeavyRain);
    const isLightRain = /light rain|drizzle|mist|slight rain|light shower/i.test(desc) || /rain|drizzle/i.test(cond) || precipProb > 60;

    if (isHeavyRain) {
      score += 50;
      reasons.push(`🌧️ Heavy rain (+50) — ${precip}mm`);
    } else if (isModRain) {
      score += 25;
      reasons.push(`🌦️ Moderate rain (+25) — ${precip}mm`);
    } else if (isLightRain) {
      score += 10;
      reasons.push(`🌂 Light rain (+10)${precipProb > 60 ? ` — ${precipProb}% chance` : ''}`);
    }
  }

  // ── Fog ──────────────────────────────────────────────────────────────────
  const isFog = /fog|haze|smoke|dust|ash/i.test(cond) || /fog|haze/i.test(desc);
  if (isFog && !isThunder) {
    score += 20;
    reasons.push('🌫️ Fog / Haze (+20)');
  }

  // ── Wind ─────────────────────────────────────────────────────────────────
  const effectiveWind = Math.max(wind, gusts * 0.8); // gusts are the bigger danger
  if (effectiveWind >= 60) {
    score += 50;
    reasons.push(`💨 Dangerous wind ${Math.round(effectiveWind)} km/h (+50)`);
  } else if (effectiveWind >= 40) {
    score += 25;
    reasons.push(`💨 Strong wind ${Math.round(effectiveWind)} km/h (+25)`);
  } else if (effectiveWind >= 20) {
    score += 10;
    reasons.push(`🌬️ Moderate wind ${Math.round(effectiveWind)} km/h (+10)`);
  }

  // ── Visibility ───────────────────────────────────────────────────────────
  if (vis != null) {
    if (vis < 2) {
      score += 40;
      reasons.push(`👁️ Very poor visibility ${vis} km (+40)`);
    } else if (vis < 5) {
      score += 20;
      reasons.push(`👁️ Poor visibility ${vis} km (+20)`);
    }
  }

  // ── Speed reduction factor ────────────────────────────────────────────────
  let speedReduction = 0;
  if (isThunder) speedReduction = 0.50;
  else if (/heavy rain/i.test(desc) || precip > 7.5) speedReduction = 0.30;
  else if (vis != null && vis < 2) speedReduction = 0.25;
  else if (effectiveWind >= 60) speedReduction = 0.20;
  else if (/rain|drizzle/i.test(cond)) speedReduction = 0.15;

  // ── Level classification ─────────────────────────────────────────────────
  let level;
  if (score >= 70)       level = RISK.SEVERE;
  else if (score >= 55)  level = RISK.HIGH;
  else if (score >= 25)  level = RISK.MEDIUM;
  else if (score >= 1)   level = RISK.LIGHT;
  else {
    reasons.push('✅ Clear conditions');
    level = RISK.SAFE;
  }

  return { ...level, numericScore: score, reasons, speedReduction };
}

/**
 * Build human-readable route alerts from enriched weather points.
 */
export function buildRouteAlerts(weatherPoints) {
  const alerts = [];
  for (const wp of weatherPoints) {
    if (!wp.weather) continue;
    const risk = wp.riskInfo || classifyRisk(wp.weather);
    if (risk.numericScore < 10) continue;

    const dist = wp.distFromStartKm;
    const eta  = wp.etaFormatted || `+${Math.round((wp.etaMs || 0) / 60000)} min`;
    const distLabel = dist === 0 ? 'at start' : `~${dist} km ahead`;

    let message, detail;
    const s = risk.numericScore;
    if (s >= 55) {
      message = `🚨 ${wp.weather.condition} expected ${distLabel}`;
      detail  = `${risk.reasons.slice(0, 2).join(' · ')} — ETA: ${eta}`;
    } else if (s >= 25) {
      message = `⚠️ ${wp.weather.condition} expected ${distLabel}`;
      detail  = `${risk.reasons.slice(0, 2).join(' · ')} — ETA: ${eta}`;
    } else {
      message = `⚡ ${wp.weather.condition} ${distLabel}`;
      detail  = `${risk.reasons[0] || ''} — ETA: ${eta}`;
    }

    alerts.push({ level: risk.key, score: s, message, detail, distFromStartKm: dist, etaFormatted: eta });
  }
  // Deduplicate consecutive same-level alerts within 30km
  return alerts.filter((a, i) =>
    i === 0 || a.level !== alerts[i - 1].level || a.distFromStartKm - alerts[i - 1].distFromStartKm > 30
  );
}

/**
 * Aggregate weather score for a whole route (for comparison).
 */
export function routeWeatherScore(weatherPoints) {
  let totalScore = 0, highCount = 0, mediumCount = 0, lightCount = 0, maxLevel = 'safe';
  let totalSpeedReduction = 0;

  for (const wp of weatherPoints) {
    const risk = wp.riskInfo || classifyRisk(wp.weather);
    totalScore += risk.numericScore || 0;
    totalSpeedReduction += risk.speedReduction || 0;

    const k = risk.key;
    if (k === 'severe' || k === 'high') { highCount++; maxLevel = 'high'; }
    else if (k === 'medium') { mediumCount++; if (maxLevel !== 'high') maxLevel = 'medium'; }
    else if (k === 'light')  { lightCount++;  if (maxLevel === 'safe') maxLevel = 'light'; }
  }

  const avgSpeedReduction = weatherPoints.length > 0 ? totalSpeedReduction / weatherPoints.length : 0;

  return { totalScore, highCount, mediumCount, lightCount, maxLevel, avgSpeedReduction };
}
