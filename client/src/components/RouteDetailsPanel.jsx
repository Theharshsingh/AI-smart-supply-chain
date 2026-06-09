/**
 * RouteDetailsPanel — STEP 10
 * Shows: Distance, Current ETA, Traffic Delay, Weather Delay,
 *        Congestion %, Rain Probability, Wind Speed, Best Route Recommendation
 */
import { motion } from 'framer-motion';
import { congestionColor } from '../services/trafficService';

function StatRow({ icon, label, value, valueColor, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: valueColor || '#f1f5f9' }}>{value}</span>
        {sub && <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function fmtDur(min) {
  if (!min) return '—';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export default function RouteDetailsPanel({ routeAnalysis, osrmRoutes, selectedIdx = 0 }) {
  const analyses = routeAnalysis?.scoredAnalyses;
  if (!analyses?.length || !osrmRoutes?.length) return null;

  const a    = analyses[selectedIdx] || analyses[0];
  const base = osrmRoutes[selectedIdx] || osrmRoutes[0];

  const distKm          = base?.distanceKm ?? a?.distanceKm ?? '—';
  const baseDur         = base?.durationMin ?? a?.durationMin ?? 0;
  const adjDur          = a?.adjustedDurationMin ?? baseDur;
  const trafficDelay    = a?.trafficDelayMin ?? 0;
  const weatherDelay    = a?.weatherDelayMin ?? 0;
  const avgCongestion   = a?.trafScore?.avgCongestion ?? 0;
  const maxCongestion   = a?.trafScore?.maxCongestion ?? 0;
  const recommended     = routeAnalysis?.recommended ?? 0;
  const reason          = routeAnalysis?.reason ?? '';

  // Derive rain prob + wind from segments
  const segs = a?.segments || [];
  const rainProb = segs.length
    ? Math.round(segs.reduce((s, sg) => s + (sg.weather?.precipProb ?? 0), 0) / segs.length)
    : 0;
  const windSpeed = segs.length
    ? Math.round(segs.reduce((s, sg) => s + (sg.weather?.windSpeed ?? 0), 0) / segs.length)
    : 0;

  const congColor = congestionColor(avgCongestion);
  const trafficDelayColor = trafficDelay > 20 ? '#ef4444' : trafficDelay > 5 ? '#f59e0b' : '#22c55e';
  const weatherDelayColor = weatherDelay > 20 ? '#ef4444' : weatherDelay > 5 ? '#f59e0b' : '#22c55e';
  const rainColor = rainProb > 70 ? '#3b82f6' : rainProb > 40 ? '#60a5fa' : '#22c55e';
  const windColor = windSpeed > 60 ? '#ef4444' : windSpeed > 35 ? '#f59e0b' : '#22c55e';

  const bestRoute = analyses[recommended];
  const isCurrent = recommended === selectedIdx;

  return (
    <motion.div className="card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span>📊</span> Route Details
        <span style={{ fontSize: 10, color: '#475569', fontWeight: 400 }}>Route {selectedIdx + 1}</span>
      </div>

      <StatRow icon="📏" label="Distance" value={`${distKm} km`} />
      <StatRow
        icon="⏱"
        label="Current ETA"
        value={fmtDur(adjDur)}
        sub={adjDur !== baseDur ? `Base: ${fmtDur(baseDur)}` : null}
      />
      <StatRow
        icon="🚦"
        label="Traffic Delay"
        value={trafficDelay > 0 ? `+${fmtDur(trafficDelay)}` : 'None'}
        valueColor={trafficDelayColor}
      />
      <StatRow
        icon="🌦"
        label="Weather Delay"
        value={weatherDelay > 0 ? `+${fmtDur(weatherDelay)}` : 'None'}
        valueColor={weatherDelayColor}
      />
      <StatRow
        icon="🛣"
        label="Avg Congestion"
        value={`${avgCongestion}%`}
        valueColor={congColor}
        sub={maxCongestion > avgCongestion ? `Peak: ${maxCongestion}%` : null}
      />
      <StatRow
        icon="🌧"
        label="Rain Probability"
        value={segs.length ? `${rainProb}%` : '—'}
        valueColor={rainColor}
      />
      <StatRow
        icon="💨"
        label="Avg Wind Speed"
        value={segs.length ? `${windSpeed} km/h` : '—'}
        valueColor={windColor}
      />

      {/* Best Route Recommendation */}
      <div style={{
        marginTop: 10, padding: '10px 12px', borderRadius: 8,
        background: isCurrent ? 'rgba(34,197,94,0.08)' : 'rgba(59,130,246,0.08)',
        border: `1px solid ${isCurrent ? 'rgba(34,197,94,0.25)' : 'rgba(59,130,246,0.25)'}`,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: isCurrent ? '#4ade80' : '#60a5fa', marginBottom: 4 }}>
          {isCurrent ? '✅ You are on the BEST route' : `💡 Route ${recommended + 1} is recommended`}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>{reason || bestRoute?.recommendation || '—'}</div>
        {!isCurrent && bestRoute && (
          <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
            Score: {Math.round((1 - (bestRoute.compositeScore ?? 0)) * 100)}/100
          </div>
        )}
      </div>
    </motion.div>
  );
}
