export function riskColor(score) {
  if (score >= 65) return '#ef4444';
  if (score >= 40) return '#f59e0b';
  return '#22c55e';
}

export function riskBadgeClass(score) {
  if (score >= 65) return 'badge-red';
  if (score >= 40) return 'badge-yellow';
  return 'badge-green';
}

export function statusBadgeClass(status) {
  if (status === 'Delayed') return 'badge-red';
  if (status === 'Risk') return 'badge-yellow';
  return 'badge-green';
}

export function modeBadgeClass(mode) {
  if (mode === 'AIR') return 'badge-purple';
  if (mode === 'TRAIN') return 'badge-blue';
  return 'badge-green';
}

export function modeIcon(mode) {
  if (mode === 'AIR') return 'AIR';
  if (mode === 'TRAIN') return 'TRAIN';
  return 'ROAD';
}

export function weatherIcon(w) {
  // Returns a label; use WeatherIcon component in UI instead
  return w || 'Clear';
}

export function weatherColor(w) {
  const map = { Clear: '#22c55e', Cloudy: '#94a3b8', Rain: '#60a5fa', Fog: '#a78bfa', Storm: '#ef4444' };
  return map[w] || '#22c55e';
}

export function fmtEta(h) {
  if (h < 1) return '< 1h';
  return `${Math.round(h)}h`;
}

/** Maps a weather risk level to a display colour (5-level per spec) */
export function weatherRiskColor(risk) {
  if (risk === 'severe')                       return '#7f1d1d'; // dark red — thunderstorm
  if (risk === 'high')                         return '#ef4444'; // red
  if (risk === 'medium' || risk === 'moderate') return '#f59e0b'; // orange
  if (risk === 'light')                        return '#eab308'; // yellow
  return '#22c55e';                                              // green — safe
}

/** Returns an emoji for a weather condition string */
export function conditionEmoji(condition = '') {
  // Returns condition label; use WeatherIcon component in UI
  return condition || 'Clear';
}
