import { weatherRiskColor } from '../utils';
import { RISK } from '../services/riskEngine';
import {
  CloudSun, CloudRain, Cloud, CloudLightning, Wind, Snowflake,
  Loader2, AlertTriangle, AlertCircle, Zap, CheckCircle,
  Eye, Droplets, Gauge,
} from 'lucide-react';

function ConditionIcon({ condition, size = 18 }) {
  const c = condition || '';
  const p = { size, strokeWidth: 1.8 };
  if (/rain|drizzle/i.test(c))         return <CloudRain {...p} color="#60a5fa" />;
  if (/cloud/i.test(c))                return <Cloud {...p} color="#94a3b8" />;
  if (/thunder|storm/i.test(c))        return <CloudLightning {...p} color="#f87171" />;
  if (/snow/i.test(c))                 return <Snowflake {...p} color="#bfdbfe" />;
  if (/fog|mist|haze|dust|smoke/i.test(c)) return <Wind {...p} color="#a78bfa" />;
  return <CloudSun {...p} color="#fcd34d" />;
}

function MiniStat({ icon: Icon, iconColor, value, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {Icon && <Icon size={9} color={iconColor || '#64748b'} />}
      <span style={{ fontSize: 10, color: '#94a3b8' }}>{value}</span>
      {label && <span style={{ fontSize: 9, color: '#475569' }}>{label}</span>}
    </div>
  );
}

export default function WeatherSegmentPanel({ weatherPoints, loading }) {
  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '18px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Loader2 size={18} style={{ animation: 'spin 0.9s linear infinite' }} />
        <div style={{ fontSize: 12, color: '#64748b' }}>Fetching ETA-matched forecasts…</div>
      </div>
    );
  }

  const validPoints = (weatherPoints || []).filter(wp => wp.weather);
  if (!validPoints.length) return null;

  const highCount   = validPoints.filter(wp => ['high', 'severe'].includes(wp.riskInfo?.key || wp.weather?.risk)).length;
  const mediumCount = validPoints.filter(wp => (wp.riskInfo?.key || wp.weather?.risk) === 'medium').length;
  const lightCount  = validPoints.filter(wp => (wp.riskInfo?.key || wp.weather?.risk) === 'light').length;
  const allClear    = highCount === 0 && mediumCount === 0 && lightCount === 0;

  // Worst segment
  const worstPoint = validPoints.reduce((w, p) => {
    const s = p.riskInfo?.numericScore || 0;
    return s > (w?.riskInfo?.numericScore || 0) ? p : w;
  }, null);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
          <CloudSun size={14} color="#60a5fa" /> ETA-Matched Route Forecast
          <span style={{ fontSize: 10, color: '#475569', fontWeight: 400 }}>
            ({validPoints.length} checkpoints)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {highCount > 0 && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: RISK.HIGH.darkBg, color: RISK.HIGH.color, border: `1px solid ${RISK.HIGH.color}44`, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <AlertTriangle size={8} /> {highCount} high
            </span>
          )}
          {mediumCount > 0 && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: RISK.MEDIUM.darkBg, color: RISK.MEDIUM.color, border: `1px solid ${RISK.MEDIUM.color}44`, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <AlertCircle size={8} /> {mediumCount} moderate
            </span>
          )}
          {lightCount > 0 && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: RISK.LIGHT.darkBg, color: RISK.LIGHT.color, border: `1px solid ${RISK.LIGHT.color}44`, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Zap size={8} /> {lightCount} light
            </span>
          )}
          {allClear && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: RISK.SAFE.darkBg, color: RISK.SAFE.color, border: `1px solid ${RISK.SAFE.color}44`, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <CheckCircle size={8} /> All clear
            </span>
          )}
        </div>
      </div>

      {/* Worst segment callout */}
      {worstPoint && (worstPoint.riskInfo?.numericScore || 0) > 0 && (
        <div style={{
          background: weatherRiskColor(worstPoint.riskInfo?.key) + '15',
          border: `1px solid ${weatherRiskColor(worstPoint.riskInfo?.key)}33`,
          borderRadius: 8, padding: '8px 12px', fontSize: 11,
        }}>
          <span style={{ fontWeight: 700, color: weatherRiskColor(worstPoint.riskInfo?.key) }}>
            ⚠ Worst Segment:
          </span>{' '}
          <span style={{ color: '#94a3b8' }}>
            {worstPoint.weather?.condition} at +{worstPoint.distFromStartKm} km
            {worstPoint.riskInfo?.speedReduction > 0 && ` — expect ${Math.round(worstPoint.riskInfo.speedReduction * 100)}% speed reduction`}
          </span>
        </div>
      )}

      {/* Same-zone notice */}
      {validPoints.length > 1 && (() => {
        const temps = validPoints.map(wp => wp.weather?.temp);
        const conds = validPoints.map(wp => wp.weather?.condition);
        const allSameTemp = temps.every(t => t === temps[0]);
        const allSameCond = conds.every(c => c === conds[0]);
        if (allSameTemp && allSameCond) return (
          <div style={{ fontSize: 11, color: '#475569', background: '#0a0e1a', borderRadius: 8, padding: '7px 12px', border: '1px solid #1e2d45' }}>
            ℹ️ All checkpoints are within the same weather zone — conditions uniform across route.
          </div>
        );
        return null;
      })()}

      {/* Segment rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {validPoints.map((wp, i) => {
          const wx      = wp.weather;
          const risk    = wp.riskInfo;
          const level   = risk?.key || 'safe';
          const color   = weatherRiskColor(level);
          const rInfo   = RISK[level.toUpperCase()] || RISK.SAFE;
          const numScore = risk?.numericScore || 0;

          const etaDisp = wp.etaFormatted || (wp.etaMs
            ? new Date(Date.now() + wp.etaMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
            : 'Now');

          const speedRedPct = Math.round((risk?.speedReduction || 0) * 100);

          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: color + '0d',
                border: `1px solid ${color}22`,
                borderLeft: `3px solid ${color}`,
              }}
            >
              <ConditionIcon condition={wx.condition} size={18} />

              {/* Left: condition + reasons + stats */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.2 }}>
                  {wx.condition}
                </div>
                {risk?.reasons?.length > 0 ? (
                  <div style={{ fontSize: 10, color, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {risk.reasons[0]}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{wx.description}</div>
                )}

                {/* Mini stats row */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <MiniStat icon={Wind} iconColor={wx.windSpeed > 60 ? '#f87171' : wx.windSpeed > 35 ? '#fcd34d' : '#64748b'} value={`${wx.windSpeed} km/h`} label="wind" />
                  {wx.windGusts > 0 && <MiniStat icon={Gauge} iconColor="#a78bfa" value={`${wx.windGusts}`} label="gusts" />}
                  {wx.precipitation > 0 && <MiniStat icon={Droplets} iconColor="#60a5fa" value={`${wx.precipitation}mm`} />}
                  {wx.precipProb > 0 && <MiniStat icon={CloudRain} iconColor="#93c5fd" value={`${wx.precipProb}%`} label="rain prob" />}
                  {wx.visibility != null && <MiniStat icon={Eye} iconColor={wx.visibility < 2 ? '#f87171' : wx.visibility < 5 ? '#fcd34d' : '#64748b'} value={`${wx.visibility} km`} label="vis" />}
                  {speedRedPct > 0 && (
                    <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>↓{speedRedPct}% speed</span>
                  )}
                </div>
              </div>

              {/* Right: temp + risk + eta + dist */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{wx.temp}°C</div>
                <div style={{
                  fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, marginTop: 2,
                  background: color + '22', color, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {rInfo.label} {numScore > 0 ? `(${numScore})` : ''}
                </div>
                <div style={{ fontSize: 10, color: '#60a5fa', marginTop: 3, fontWeight: 600 }}>
                  {wp.distFromStartKm === 0 ? 'START' : `+${wp.distFromStartKm} km`}
                </div>
                <div style={{ fontSize: 9, color: '#334155' }}>{etaDisp}</div>
                {wx.forecastTime && <div style={{ fontSize: 9, color: '#1d4ed8' }}>forecast</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ fontSize: 10, color: '#334155', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>🟢 Safe=0 pts</span>
        <span>🟡 Light=1-24</span>
        <span>🟠 Moderate=25-54</span>
        <span>🔴 High=55+</span>
        <span>⛈ Storm=70+</span>
      </div>
    </div>
  );
}
