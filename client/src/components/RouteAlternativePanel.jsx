import { motion } from 'framer-motion';
import { RISK } from '../services/riskEngine';
import { congestionColor } from '../services/trafficService';
import { weatherRiskColor } from '../utils';
import { Clock, Wind, Zap } from 'lucide-react';

function ScoreBar({ value, color }) {
  return (
    <div style={{ background: '#1e2d45', borderRadius: 999, height: 3, overflow: 'hidden', marginTop: 2 }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.round(Math.max(0, 1 - value) * 100))}%`, background: color, borderRadius: 999, transition: 'width 0.6s' }} />
    </div>
  );
}

export default function RouteAlternativePanel({ routeAnalysis, rerouteLoading, selectedIdx, onSelectRoute }) {
  if (rerouteLoading) {
    return (
      <div className="card2" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
        <span className="spin-anim" style={{ fontSize: 16 }}>⟳</span>
        <span style={{ fontSize: 12, color: '#64748b' }}>Analysing traffic + weather for all routes…</span>
      </div>
    );
  }

  const analyses = routeAnalysis?.scoredAnalyses;
  if (!analyses?.length) return null;

  const { recommended, reason, timeDiffMin, riskImprovement, _betterRouteAvailable } = routeAnalysis;
  const isBetterAvailable = _betterRouteAvailable || (recommended != null && recommended !== selectedIdx);

  return (
    <motion.div className="card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🔀</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Traffic + Weather Route Comparison</div>
          {isBetterAvailable && (
            <div style={{ fontSize: 11, color: '#4ade80', marginTop: 2, fontWeight: 600 }}>
              💡 Better route available — {reason}
            </div>
          )}
        </div>
        <div style={{ fontSize: 9, color: '#334155', textAlign: 'right', lineHeight: 1.7 }}>
          <div>⏱ 40% Time</div>
          <div>🌦 35% Weather</div>
          <div>🚦 25% Traffic</div>
        </div>
      </div>

      {/* Route rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {analyses.map((a, idx) => {
          const wxScore   = a.wxScore    || a.weatherScore || {};
          const trafScore = a.trafScore  || {};
          const isSelected = idx === selectedIdx;
          const isBest     = idx === recommended;
          const composite  = a.compositeScore ?? 0;
          const wxColor    = weatherRiskColor(wxScore.maxLevel || 'safe');
          const trafClr    = congestionColor(trafScore.avgCongestion || 0);
          const trafficDelay = a.trafficDelayMin || 0;
          const weatherDelay = a.weatherDelayMin || 0;

          return (
            <button
              key={idx}
              onClick={() => onSelectRoute?.(idx)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                background: isSelected ? '#0c1a3a' : '#111827',
                border: `1px solid ${isSelected ? '#3b82f6' : '#1e2d45'}`,
                transition: 'all 0.15s', textAlign: 'left', width: '100%',
                outline: 'none', position: 'relative',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = '#2d3f5c'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = '#1e2d45'; }}
            >
              {/* Number circle */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: isSelected ? '#1e40af' : '#1a2235',
                border: `2px solid ${isSelected ? '#3b82f6' : '#334155'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: isSelected ? '#fff' : '#94a3b8',
              }}>
                {idx + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Label */}
                {a.recommendation && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: isBest ? '#4ade80' : '#64748b', marginBottom: 4 }}>
                    {a.recommendation}
                  </div>
                )}

                {/* Time + delays */}
                <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={9} /> {a.durationMin} min
                  </span>
                  {trafficDelay > 0 && (
                    <span style={{ color: trafClr, fontSize: 10 }}>🚦 +{trafficDelay}m traffic</span>
                  )}
                  {weatherDelay > 0 && (
                    <span style={{ color: wxColor, fontSize: 10 }}>🌦 +{weatherDelay}m weather</span>
                  )}
                  <span style={{ color: '#475569' }}>📍 {a.distanceKm} km</span>
                </div>

                {/* Traffic + Weather badges */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
                  {/* Traffic */}
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: trafClr + '22', color: trafClr, fontWeight: 700, border: `1px solid ${trafClr}44` }}>
                    🚦 {trafScore.avgCongestion || 0}% congestion
                  </span>
                  {trafScore.maxCongestion >= 60 && (
                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: '#450a0a', color: '#f87171', fontWeight: 700 }}>
                      ⚠ {trafScore.maxCongestion}% peak
                    </span>
                  )}
                  {/* Weather */}
                  {wxScore.highCount > 0 && (
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: RISK.HIGH.darkBg, color: RISK.HIGH.color, fontWeight: 700 }}>
                      🚨 {wxScore.highCount} wx-high
                    </span>
                  )}
                  {wxScore.mediumCount > 0 && (
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: RISK.MEDIUM.darkBg, color: RISK.MEDIUM.color, fontWeight: 700 }}>
                      ⚠️ {wxScore.mediumCount} wx-mod
                    </span>
                  )}
                  {wxScore.totalScore === 0 && trafScore.avgCongestion < 20 && (
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: RISK.SAFE.darkBg, color: RISK.SAFE.color, fontWeight: 700 }}>
                      ✅ Clear
                    </span>
                  )}
                </div>

                {/* Score bar */}
                <div style={{ marginTop: 2 }}>
                  <div style={{ fontSize: 9, color: '#334155', display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                    <span>Combined Score</span>
                    <span style={{ color: isBest ? '#4ade80' : '#64748b' }}>
                      {Math.round((1 - composite) * 100)}/100 {isBest ? '★' : ''}
                    </span>
                  </div>
                  <ScoreBar value={composite} color={isBest ? '#22c55e' : '#334155'} />
                </div>
              </div>

              {/* Best badge */}
              {isBest && (
                <div style={{
                  position: 'absolute', top: -9, right: 8,
                  background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                  color: '#fff', fontSize: 8, fontWeight: 800,
                  padding: '2px 7px', borderRadius: 999,
                }}>
                  ★ BEST ROUTE
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      {isBetterAvailable && timeDiffMin != null && (
        <div style={{ fontSize: 11, color: '#64748b', paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {timeDiffMin > 0
            ? `⏱ Best route adds ${timeDiffMin} min`
            : timeDiffMin < 0
              ? `⚡ Best route saves ${Math.abs(timeDiffMin)} min`
              : '⏱ Same time — better conditions'}
          {riskImprovement && ` · ${riskImprovement}`}
        </div>
      )}
    </motion.div>
  );
}
