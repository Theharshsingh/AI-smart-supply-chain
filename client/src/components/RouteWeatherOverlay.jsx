import { Polyline, CircleMarker, Popup } from 'react-leaflet';
import { weatherRiskColor, conditionEmoji } from '../utils';
import { RISK } from '../services/riskEngine';

/**
 * Renders weather-risk coloured polyline segments and circular markers
 * on the Leaflet map.
 *
 * Risk colour legend:
 *  🟢 safe   → #22c55e
 *  🟡 light  → #84cc16
 *  🟠 medium → #f59e0b
 *  🔴 high   → #ef4444
 */
export default function RouteWeatherOverlay({ weatherPoints }) {
  if (!weatherPoints?.length) return null;

  return (
    <>
      {/* ── Coloured polyline segments ── */}
      {weatherPoints.map((wp, i) => {
        if (i === 0) return null;
        const prev   = weatherPoints[i - 1];
        const level  = wp.riskInfo?.key || wp.weather?.risk || 'safe';
        const color  = weatherRiskColor(level);
        const isBad  = level === 'high' || level === 'medium';

        return (
          <Polyline
            key={`wx-seg-${i}`}
            positions={[[prev.lat, prev.lng], [wp.lat, wp.lng]]}
            pathOptions={{
              color,
              weight: isBad ? 7 : 5,
              opacity: isBad ? 0.85 : 0.55,
              dashArray: level === 'high' ? '6 4' : level === 'medium' ? '10 5' : null,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        );
      })}

      {/* ── Weather marker at each sampled point ── */}
      {weatherPoints.map((wp, i) => {
        const wx    = wp.weather;
        if (!wx) return null;
        const level  = wp.riskInfo?.key || wx.risk || 'safe';
        const color  = weatherRiskColor(level);
        const rInfo  = RISK[level.toUpperCase()] || RISK.SAFE;
        const radius = level === 'high' ? 11 : level === 'medium' ? 9 : level === 'light' ? 7 : 5;

        const etaDisplay = wp.etaFormatted || (wp.etaMs
          ? new Date(Date.now() + wp.etaMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
          : 'Now');

        return (
          <CircleMarker
            key={`wx-pt-${i}`}
            center={[wp.lat, wp.lng]}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.92,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{
                background: '#111827', color: '#e2e8f0',
                padding: '10px 12px', borderRadius: 10,
                minWidth: 200, fontFamily: 'Inter, sans-serif',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{conditionEmoji(wx.condition)}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{wx.condition}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
                    background: color + '33', color,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {rInfo.label}
                  </span>
                </div>

                {/* Reasons */}
                {wp.riskInfo?.reasons?.length > 0 && (
                  <div style={{ marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {wp.riskInfo.reasons.map((r, ri) => (
                      <div key={ri} style={{ fontSize: 10, color: color, fontWeight: 600 }}>{rInfo.emoji} {r}</div>
                    ))}
                  </div>
                )}

                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                  <div style={{ color: '#94a3b8', fontStyle: 'italic', marginBottom: 2 }}>{wx.description}</div>
                  <div>🌡️ <b style={{ color: '#f1f5f9' }}>{wx.temp}°C</b> · 💧 {wx.humidity}%</div>
                  <div>💨 Wind: <b style={{ color: wx.windSpeed > 60 ? '#ef4444' : wx.windSpeed > 35 ? '#f59e0b' : '#f1f5f9' }}>{wx.windSpeed} km/h</b></div>
                  {wx.visibility != null && <div>👁️ Visibility: <b>{wx.visibility} km</b></div>}
                  <div style={{ color: '#60a5fa', marginTop: 4 }}>
                    ⏱ ETA: <b>{etaDisplay}</b>
                    {wx.forecastTime && <span style={{ color: '#475569', fontSize: 9 }}> (forecast)</span>}
                  </div>
                  <div style={{ color: '#475569' }}>
                    📍 {wp.distFromStartKm === 0 ? 'Route start' : `${wp.distFromStartKm} km from start`}
                  </div>
                  {wx.source === 'heuristic' && (
                    <div style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>
                      ⚙ Estimated — add OPENWEATHER_API_KEY for live forecast
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
