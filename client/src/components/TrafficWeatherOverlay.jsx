import { Polyline, CircleMarker, Popup } from 'react-leaflet';
import { congestionColor } from '../services/trafficService';

/**
 * Traffic color bands (spec):
 *  Green     0–20%
 *  Yellow   20–40%
 *  Orange   40–60%
 *  Red      60–80%
 *  Dark Red 80–100%
 */

/**
 * Spec STEP 9 weather colors:
 *  Purple → Thunderstorm/Storm
 *  Blue   → Rain/Drizzle/Snow
 *  Orange → Fog/Wind risk
 *  Yellow → Light risk
 *  Green  → Clear
 */
function wxConditionColor(wx, score) {
  const cond = (wx?.condition || '').toLowerCase();
  if (/storm|thunder/i.test(cond)) return '#a855f7'; // purple
  if (/rain|drizzle|snow|shower/i.test(cond)) return '#3b82f6'; // blue
  if (score >= 55) return '#ef4444';
  if (score >= 25) return '#f97316';
  if (score >= 1)  return '#eab308';
  return '#22c55e';
}

function fmtSpeed(s) { return s != null ? `${s} km/h` : '—'; }
function fmtTime(ms) {
  if (!ms) return null;
  const m = Math.round(ms / 1000 / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m/60)}h ${m%60}m`;
}

export default function TrafficWeatherOverlay({ segments }) {
  if (!segments?.length) return null;

  return (
    <>
      {/* ── Traffic polyline segments ── */}
      {segments.map((seg, i) => {
        if (i === 0) return null;
        const prev  = segments[i - 1];
        const traf  = seg.traffic;
        if (!traf) return null;
        const color = congestionColor(traf.congestionPct || 0);
        const heavy = traf.congestionPct >= 40;

        return (
          <Polyline
            key={`traf-seg-${i}`}
            positions={[[prev.lat, prev.lng], [seg.lat, seg.lng]]}
            pathOptions={{
              color,
              weight:    heavy ? 9 : 5,
              opacity:   heavy ? 0.88 : 0.5,
              dashArray: traf.congestionPct >= 60 ? '6 3' : null,
              lineCap:   'round',
              lineJoin:  'round',
            }}
          />
        );
      })}

      {/* ── Traffic info dots ── */}
      {segments.map((seg, i) => {
        const traf = seg.traffic;
        if (!traf || traf.congestionPct < 20) return null; // skip green segments
        const color  = congestionColor(traf.congestionPct);
        const radius = traf.congestionPct >= 60 ? 10 : traf.congestionPct >= 40 ? 8 : 6;

        const etaDisp = seg.etaFormatted
          || (seg.etaTimestamp ? new Date(seg.etaTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : null);

        const delay = (traf.travelTime && traf.freeFlowTime)
          ? Math.max(0, Math.round((traf.travelTime - traf.freeFlowTime) / 60))
          : null;

        return (
          <CircleMarker
            key={`traf-pt-${i}`}
            center={[seg.lat, seg.lng]}
            radius={radius}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.9, weight: 2 }}
          >
            <Popup>
              <div style={{ background: '#111827', color: '#e2e8f0', padding: '10px 12px', borderRadius: 10, minWidth: 200, fontFamily: 'Inter, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>🚦</span>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Traffic Congestion</span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: color + '33', color, marginLeft: 'auto' }}>
                    {traf.congestionPct}%
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                  <div>🏎️ Current speed: <b style={{ color: '#f1f5f9' }}>{fmtSpeed(traf.currentSpeed)}</b></div>
                  <div>🆓 Free flow: <b style={{ color: '#22c55e' }}>{fmtSpeed(traf.freeFlowSpeed)}</b></div>
                  {delay != null && delay > 0 && (
                    <div style={{ color: '#f59e0b' }}>⏱ Delay: <b>+{delay} min</b></div>
                  )}
                  {traf.travelTimeRatio > 1 && (
                    <div style={{ color: '#94a3b8' }}>⚖ Travel ratio: <b>{traf.travelTimeRatio}×</b></div>
                  )}
                  {etaDisp && (
                    <div style={{ color: '#60a5fa', marginTop: 3 }}>📍 ETA here: <b>{etaDisp}</b></div>
                  )}
                  <div style={{ color: '#475569', marginTop: 2 }}>
                    {seg.distFromStartKm === 0 ? 'Route start' : `+${seg.distFromStartKm} km from start`}
                  </div>
                  <div style={{ fontSize: 9, color: '#334155', marginTop: 3 }}>
                    Source: {traf.source === 'tomtom' ? '🟡 TomTom Live' : '⚙ Estimated'}
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* ── Weather risk circles (on top) ── */}
      {segments.map((seg, i) => {
        const wx    = seg.weather;
        const risk  = seg.wxRisk || seg.riskInfo;
        if (!wx || !risk) return null;
        const score  = risk.numericScore || 0;
        if (score < 1) return null; // skip clear segments to reduce clutter
        const color  = wxConditionColor(wx, score);
        const radius = score >= 55 ? 8 : 5;

        const etaDisp = seg.etaFormatted
          || (seg.etaTimestamp ? new Date(seg.etaTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : null);

        return (
          <CircleMarker
            key={`wx-pt-${i}`}
            center={[seg.lat, seg.lng]}
            radius={radius}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1.5 }}
          >
            <Popup>
              <div style={{ background: '#111827', color: '#e2e8f0', padding: '10px 12px', borderRadius: 10, minWidth: 200, fontFamily: 'Inter, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{wx.condition}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: color + '33', color, textTransform: 'uppercase' }}>
                    {risk.label} ({score})
                  </span>
                </div>
                {risk.reasons?.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    {risk.reasons.slice(0, 2).map((r, ri) => (
                      <div key={ri} style={{ fontSize: 10, color, fontWeight: 600 }}>{r}</div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                  <div>🌡️ <b>{wx.temp}°C</b> · 💧 {wx.humidity}%</div>
                  <div>💨 Wind: <b>{wx.windSpeed} km/h</b>{wx.windGusts > 0 && ` (gusts ${wx.windGusts})`}</div>
                  {wx.precipitation > 0 && <div>🌧️ {wx.precipitation}mm · {wx.precipProb}% chance</div>}
                  {wx.visibility != null && <div>👁️ Visibility: {wx.visibility} km</div>}
                  {risk.speedReduction > 0 && (
                    <div style={{ color: '#f59e0b' }}>🚗 Speed ↓{Math.round(risk.speedReduction * 100)}%</div>
                  )}
                  {etaDisp && <div style={{ color: '#60a5fa', marginTop: 3 }}>⏱ ETA: <b>{etaDisp}</b></div>}
                  {wx.forecastTime && <div style={{ fontSize: 9, color: '#3b82f6' }}>📡 Forecast for this time</div>}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
