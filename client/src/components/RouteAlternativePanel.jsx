import { motion } from 'framer-motion';
import { RISK } from '../services/riskEngine';
import { weatherRiskColor } from '../utils';
import { Shield, Clock, Wind, Zap } from 'lucide-react';

function ScoreBar({ value, color }) {
  return (
    <div style={{ background: '#1e2d45', borderRadius: 999, height: 4, overflow: 'hidden', marginTop: 3 }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.round(value * 100))}%`, background: color, borderRadius: 999, transition: 'width 0.6s' }} />
    </div>
  );
}

export default function RouteAlternativePanel({ routeAnalysis, rerouteLoading, selectedIdx, onSelectRoute }) {
  if (rerouteLoading) {
    return (
      <div className="card2" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
        <span className="spin-anim" style={{ fontSize: 16 }}>⟳</span>
        <span style={{ fontSize: 12, color: '#64748b' }}>Analysing routes for best weather score…</span>
      </div>
    );
  }

  const analyses = routeAnalysis?.scoredAnalyses || routeAnalysis?.analyses;
  if (!analyses?.length || analyses.length < 2) return null;

  const { best, reason, timeDiffMin, riskImprovement } = routeAnalysis;
  const bestIdx = best?.recommended ?? routeAnalysis?.best?.recommended;
  const isBetterAvailable = bestIdx != null && bestIdx !== selectedIdx;

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🔀</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Weather-Aware Route Comparison</div>
          {isBetterAvailable && (
            <div style={{ fontSize: 11, color: '#4ade80', marginTop: 2, fontWeight: 600 }}>
              💡 Better weather route available — {reason}
            </div>
          )}
        </div>
        {/* Weight legend */}
        <div style={{ fontSize: 9, color: '#334155', textAlign: 'right', lineHeight: 1.6 }}>
          <div>⏱ 40% Time</div>
          <div>🌦 35% Weather</div>
          <div>🛡 25% Safety</div>
        </div>
      </div>

      {/* Route cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {analyses.map((a, idx) => {
          const score      = a.weatherScore;
          const isSelected = idx === selectedIdx;
          const isBest     = idx === bestIdx;
          const maxRisk    = RISK[(score.maxLevel || 'safe').toUpperCase()] || RISK.SAFE;
          const color      = weatherRiskColor(score.maxLevel);
          const composite  = a.compositeScore;
          const delay      = (a.adjustedDurationMin || a.durationMin) - (a.durationMin || 0);
          const speedPct   = Math.round((score.avgSpeedReduction || 0) * 100);

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
              {/* Route number */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: isSelected ? '#1e40af' : '#1a2235',
                border: `2px solid ${isSelected ? '#3b82f6' : '#334155'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: isSelected ? '#fff' : '#94a3b8',
              }}>
                {idx + 1}
              </div>

              {/* Info block */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Recommendation label */}
                {a.recommendation && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: isBest ? '#4ade80' : '#64748b', marginBottom: 4 }}>
                    {a.recommendation}
                  </div>
                )}

                {/* Time row */}
                <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={9} /> {a.durationMin} min
                  </span>
                  {delay > 0 && (
                    <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Wind size={9} /> +{delay}m weather delay
                    </span>
                  )}
                  {speedPct > 0 && (
                    <span style={{ color: '#f87171', fontSize: 10 }}>↓{speedPct}% speed</span>
                  )}
                  <span>📍 {a.distanceKm} km</span>
                </div>

                {/* Risk badges */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {score.highCount > 0 && (
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: RISK.HIGH.darkBg, color: RISK.HIGH.color, fontWeight: 700 }}>
                      🚨 {score.highCount} high
                    </span>
                  )}
                  {score.mediumCount > 0 && (
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: RISK.MEDIUM.darkBg, color: RISK.MEDIUM.color, fontWeight: 700 }}>
                      ⚠️ {score.mediumCount} medium
                    </span>
                  )}
                  {score.lightCount > 0 && (
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: RISK.LIGHT.darkBg, color: RISK.LIGHT.color, fontWeight: 700 }}>
                      ⚡ {score.lightCount} light
                    </span>
                  )}
                  {score.totalScore === 0 && (
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: RISK.SAFE.darkBg, color: RISK.SAFE.color, fontWeight: 700 }}>
                      ✅ Clear
                    </span>
                  )}
                </div>

                {/* Composite score bar */}
                {composite != null && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 9, color: '#334155', marginBottom: 1, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Route Score</span>
                      <span style={{ color: isBest ? '#4ade80' : '#64748b' }}>{(composite * 100).toFixed(0)}/100 {isBest ? '(best)' : ''}</span>
                    </div>
                    <ScoreBar value={1 - composite} color={isBest ? '#22c55e' : '#334155'} />
                  </div>
                )}
              </div>

              {/* Right: max risk + score */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontSize: 9, fontWeight: 800, padding: '3px 7px', borderRadius: 4,
                  background: color + '22', color,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {maxRisk.label}
                </div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 3 }}>
                  Risk: {score.totalScore}pts
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
                  ★ BEST SCORE
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Time impact footer */}
      {isBetterAvailable && timeDiffMin != null && (
        <div style={{ fontSize: 11, color: '#64748b', paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {timeDiffMin > 0
            ? `⏱ Safest route adds ${timeDiffMin} min`
            : timeDiffMin < 0
              ? `⚡ Safest route also saves ${Math.abs(timeDiffMin)} min`
              : '⏱ Same travel time — better weather'}
          {riskImprovement && ` · ${riskImprovement}`}
        </div>
      )}
    </motion.div>
  );
}
