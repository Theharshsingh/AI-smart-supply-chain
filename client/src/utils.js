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
  if (mode === 'AIR') return '✈';
  if (mode === 'TRAIN') return '🚂';
  return '🚛';
}

export function weatherIcon(w) {
  const map = { Clear: '☀️', Cloudy: '☁️', Rain: '🌧️', Fog: '🌫️', Storm: '⛈️' };
  return map[w] || '☀️';
}

export function weatherColor(w) {
  const map = { Clear: '#22c55e', Cloudy: '#94a3b8', Rain: '#60a5fa', Fog: '#a78bfa', Storm: '#ef4444' };
  return map[w] || '#22c55e';
}

export function fmtEta(h) {
  if (h < 1) return '< 1h';
  return `${Math.round(h)}h`;
}

/** Maps a weather risk level to a display colour */
export function weatherRiskColor(risk) {
  if (risk === 'high'   || risk === 'severe')   return '#ef4444';
  if (risk === 'medium' || risk === 'moderate') return '#f59e0b';
  if (risk === 'light')                         return '#84cc16';
  return '#22c55e';
}

/** Returns an emoji for a weather condition string */
export function conditionEmoji(condition = '') {
  const map = {
    Clear: '☀️', Clouds: '☁️', Cloudy: '☁️',
    Rain: '🌧️', Drizzle: '🌦️',
    Thunderstorm: '⛈️', Storm: '⛈️',
    Snow: '❄️',
    Mist: '🌫️', Fog: '🌫️', Haze: '🌫️',
    Dust: '💨', Smoke: '💨', Sand: '💨',
    Tornado: '🌪️', Squall: '🌀',
  };
  return map[condition] || '🌤️';
}
