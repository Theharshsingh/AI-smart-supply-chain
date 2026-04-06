/**
 * riskEngine.js
 * Classifies weather risk for individual route waypoints and generates
 * human-readable route-level alerts (with ETA time and distance).
 *
 * Risk levels (aligned with the spec):
 *  SAFE   – clear, fine conditions          → score 0
 *  LIGHT  – light rain, cloudy, drizzle     → score 1
 *  MEDIUM – moderate rain, fog, snow, haze  → score 2
 *  HIGH   – heavy rain, thunderstorm, storm → score 3
 */

// ── Risk level descriptors ────────────────────────────────────────────────────
export const RISK = {
  SAFE:   { key: 'safe',   label: 'Safe',         score: 0, color: '#22c55e', darkBg: 'rgba(34,197,94,0.1)',   emoji: '✅' },
  LIGHT:  { key: 'light',  label: 'Light Risk',   score: 1, color: '#84cc16', darkBg: 'rgba(132,204,22,0.1)',  emoji: '⚡' },
  MEDIUM: { key: 'medium', label: 'Medium Risk',  score: 2, color: '#f59e0b', darkBg: 'rgba(245,158,11,0.1)', emoji: '⚠️' },
  HIGH:   { key: 'high',   label: 'High Risk',    score: 3, color: '#ef4444', darkBg: 'rgba(239,68,68,0.1)',   emoji: '🚨' },
};

// Condition → risk level keyword mapping (order: HIGH checked first)
const HIGH_CONDITIONS = ['storm', 'thunderstorm', 'tornado', 'squall', 'heavy rain', 'heavy shower'];
const MEDIUM_CONDITIONS = ['rain', 'fog', 'snow', 'sleet', 'blizzard', 'haze', 'smoke', 'dust', 'drizzle', 'mist', 'shower'];
const LIGHT_CONDITIONS  = ['cloudy', 'clouds', 'overcast', 'partly'];

/**
 * Classify risk from a normalised weather data object.
 *
 * @param {{ condition: string, description?: string, windSpeed: number, visibility?: number|null }} wx
 * @returns {{ level: string, score: number, color: string, label: string, emoji: string, reasons: string[] }}
 */
export function classifyRisk(wx) {
  if (!wx) return { ...RISK.SAFE, reasons: [] };

  const cond = (wx.condition || '').toLowerCase();
  const desc = (wx.description || '').toLowerCase();
  const wind = wx.windSpeed || 0;         // km/h
  const vis  = wx.visibility;             // km or null

  const reasons = [];

  // ── HIGH ─────────────────────────────────────────────────────────────────
  const isHigh =
    HIGH_CONDITIONS.some(k => cond.includes(k) || desc.includes(k)) ||
    wind > 70 ||
    (vis != null && vis < 1);

  if (isHigh) {
    if (HIGH_CONDITIONS.some(k => cond.includes(k) || desc.includes(k)))
      reasons.push(`${wx.condition} conditions`);
    if (wind > 70) reasons.push(`Dangerous winds ${wind} km/h`);
    if (vis != null && vis < 1) reasons.push(`Visibility < 1 km`);
    return { ...RISK.HIGH, reasons };
  }

  // ── MEDIUM ───────────────────────────────────────────────────────────────
  const isMedium =
    MEDIUM_CONDITIONS.some(k => cond.includes(k) || desc.includes(k)) ||
    wind > 40 ||
    (vis != null && vis < 3);

  if (isMedium) {
    if (MEDIUM_CONDITIONS.some(k => cond.includes(k) || desc.includes(k)))
      reasons.push(`${wx.condition} on route`);
    if (wind > 40) reasons.push(`Strong winds ${wind} km/h`);
    if (vis != null && vis < 3) reasons.push(`Reduced visibility ${vis} km`);
    return { ...RISK.MEDIUM, reasons };
  }

  // ── LIGHT ────────────────────────────────────────────────────────────────
  const isLight =
    LIGHT_CONDITIONS.some(k => cond.includes(k) || desc.includes(k)) ||
    wind > 25;

  if (isLight) {
    if (LIGHT_CONDITIONS.some(k => cond.includes(k) || desc.includes(k)))
      reasons.push(`${wx.condition} skies`);
    if (wind > 25) reasons.push(`Moderate winds ${wind} km/h`);
    return { ...RISK.LIGHT, reasons };
  }

  return { ...RISK.SAFE, reasons: ['Clear conditions'] };
}

/**
 * Given enriched weather points, build human-readable alert messages.
 * Each alert has: { level, message, detail, distFromStartKm, etaFormatted }
 *
 * @param {Array<{weather, distFromStartKm, etaFormatted}>} weatherPoints
 * @returns {Array<{level, message, detail, distFromStartKm, etaFormatted}>}
 */
export function buildRouteAlerts(weatherPoints) {
  const alerts = [];

  for (const wp of weatherPoints) {
    if (!wp.weather) continue;
    const risk = classifyRisk(wp.weather);
    if (risk.score < 1) continue;           // safe — no alert

    const dist = wp.distFromStartKm;
    const eta  = wp.etaFormatted || `+${Math.round((wp.etaMs || 0) / 60000)} min`;
    const distLabel = dist === 0 ? 'at start' : `~${dist} km ahead`;

    let message, detail;
    if (risk.score === 3) {
      message = `🚨 ${wp.weather.condition} expected ${distLabel}`;
      detail  = `${risk.reasons.join(' · ')} — ETA: ${eta}`;
    } else if (risk.score === 2) {
      message = `⚠️ ${wp.weather.condition} expected ${distLabel}`;
      detail  = `${risk.reasons.join(' · ')} — ETA: ${eta}`;
    } else {
      message = `⚡ ${wp.weather.condition} ${distLabel}`;
      detail  = `${risk.reasons.join(' · ')} — ETA: ${eta}`;
    }

    alerts.push({ level: risk.key, score: risk.score, message, detail, distFromStartKm: dist, etaFormatted: eta });
  }

  // Deduplicate consecutive same-level alerts for readability
  return alerts.filter((a, i) => i === 0 || a.level !== alerts[i - 1].level || a.distFromStartKm - alerts[i - 1].distFromStartKm > 30);
}

/**
 * Compute a single aggregate weather risk score for a route.
 * Used to compare alternative routes.
 *
 * @param {Array<{weather}>} weatherPoints
 * @returns {{ totalScore, highCount, mediumCount, lightCount, maxLevel }}
 */
export function routeWeatherScore(weatherPoints) {
  let totalScore = 0, highCount = 0, mediumCount = 0, lightCount = 0, maxLevel = 'safe';

  for (const wp of weatherPoints) {
    const risk = classifyRisk(wp.weather);
    totalScore += risk.score;
    if (risk.key === 'high')   { highCount++;   maxLevel = 'high'; }
    else if (risk.key === 'medium') { mediumCount++; if (maxLevel !== 'high') maxLevel = 'medium'; }
    else if (risk.key === 'light')  { lightCount++;  if (maxLevel === 'safe') maxLevel = 'light'; }
  }

  return { totalScore, highCount, mediumCount, lightCount, maxLevel };
}
