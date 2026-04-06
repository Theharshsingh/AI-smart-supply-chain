import { weatherRiskColor, conditionEmoji } from '../utils';
import { RISK } from '../services/riskEngine';

/**
 * WeatherSegmentPanel
 * Vertical timeline of weather conditions at each sampled route waypoint.
 * Shows LIGHT / MEDIUM / HIGH risk levels with ETA times and reasons.
 */
export default function WeatherSegmentPanel({ weatherPoints, loading }) {
  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '18px 16px' }}>
        <div className="spin-anim" style={{ fontSize: 22, display: 'inline-flex', marginBottom: 8 }}>⟳</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>Analysing route weather…</div>
      </div>
    );
  }

  const validPoints = (weatherPoints || []).filter(wp => wp.weather);
  if (!validPoints.length) return null;

  const highCount   = validPoints.filter(wp => (wp.riskInfo?.key || wp.weather?.risk) === 'high').length;
  const mediumCount = validPoints.filter(wp => (wp.riskInfo?.key || wp.weather?.risk) === 'medium').length;
  const lightCount  = validPoints.filter(wp => (wp.riskInfo?.key || wp.weather?.risk) === 'light').length;
  const allClear    = highCount === 0 && mediumCount === 0 && lightCount === 0;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
          🌦️ Route Weather Forecast
          <span style={{ fontSize: 10, color: '#475569', fontWeight: 400 }}>
            ({validPoints.length} checkpoints)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {highCount > 0 && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: RISK.HIGH.darkBg, color: RISK.HIGH.color, border: `1px solid ${RISK.HIGH.color}44` }}>
              🚨 {highCount} high
            </span>
          )}
          {mediumCount > 0 && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: RISK.MEDIUM.darkBg, color: RISK.MEDIUM.color, border: `1px solid ${RISK.MEDIUM.color}44` }}>
              ⚠️ {mediumCount} medium
            </span>
          )}
          {lightCount > 0 && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: RISK.LIGHT.darkBg, color: RISK.LIGHT.color, border: `1px solid ${RISK.LIGHT.color}44` }}>
              ⚡ {lightCount} light
            </span>
          )}
          {allClear && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: RISK.SAFE.darkBg, color: RISK.SAFE.color, border: `1px solid ${RISK.SAFE.color}44` }}>
              ✅ All clear
            </span>
          )}
        </div>
      </div>

      {/* Segment rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {validPoints.map((wp, i) => {
          const wx     = wp.weather;
          const level  = wp.riskInfo?.key || wx.risk || 'safe';
          const color  = weatherRiskColor(level);
          const rInfo  = RISK[level.toUpperCase()] || RISK.SAFE;
          const etaDisp = wp.etaFormatted || (wp.etaMs
            ? new Date(Date.now() + wp.etaMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
            : 'Now');

          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', borderRadius: 8,
                background: color + '0d',
                border: `1px solid ${color}22`,
                borderLeft: `3px solid ${color}`,
              }}
            >
              {/* Emoji */}
              <span style={{ fontSize: 18, flexShrink: 0 }}>{conditionEmoji(wx.condition)}</span>

              {/* Condition + reasons */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.2 }}>
                  {wx.condition}
                </div>
                {wp.riskInfo?.reasons?.length > 0 ? (
                  <div style={{ fontSize: 10, color: color, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {wp.riskInfo.reasons.join(' · ')}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{wx.description}</div>
                )}
              </div>

              {/* Temp + wind */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{wx.temp}°C</div>
                <div style={{ fontSize: 10, color: wx.windSpeed > 60 ? '#f87171' : wx.windSpeed > 35 ? '#fcd34d' : '#64748b' }}>
                  💨 {wx.windSpeed} km/h
                </div>
                {wx.forecastTime && (
                  <div style={{ fontSize: 9, color: '#3b82f6', marginTop: 1 }}>🔮 forecast</div>
                )}
              </div>

              {/* Risk badge + position */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                  background: color + '22', color,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {rInfo.label}
                </div>
                <div style={{ fontSize: 10, color: '#60a5fa', marginTop: 3, fontWeight: 600 }}>
                  {wp.distFromStartKm === 0 ? 'START' : `+${wp.distFromStartKm} km`}
                </div>
                <div style={{ fontSize: 9, color: '#334155' }}>{etaDisp}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer — heuristic notice */}
      {validPoints.some(wp => wp.weather?.source === 'heuristic') && (
        <div style={{ fontSize: 10, color: '#334155', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
          ⚙ Some data estimated. Add <code style={{ color: '#60a5fa' }}>OPENWEATHER_API_KEY</code> to <code style={{ color: '#60a5fa' }}>server/.env</code> for live ETA-matched forecasts.
        </div>
      )}
    </div>
  );
}
