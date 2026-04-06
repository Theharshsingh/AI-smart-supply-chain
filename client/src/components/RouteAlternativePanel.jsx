import { motion } from 'framer-motion';
import { RISK } from '../services/riskEngine';
import { weatherRiskColor } from '../utils';

/**
 * RouteAlternativePanel
 * Shows a comparison of all alternative routes by weather risk score
 * and recommends the best option.
 */
export default function RouteAlternativePanel({
  routeAnalysis,
  rerouteLoading,
  selectedIdx,
  onSelectRoute,
}) {
  if (rerouteLoading) {
    return (
      <div className="card2" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
        <span className="spin-anim" style={{ fontSize: 16 }}>⟳</span>
        <span style={{ fontSize: 12, color: '#64748b' }}>Analysing alternative routes for weather…</span>
      </div>
    );
  }

  if (!routeAnalysis?.analyses?.length) return null;

  const { analyses, best } = routeAnalysis;
  if (analyses.length < 2) return null;

  const isBetterRouteAvailable = best.recommended !== selectedIdx;

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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
            Route Weather Comparison
          </div>
          {isBetterRouteAvailable && (
            <div style={{ fontSize: 11, color: '#4ade80', marginTop: 2, fontWeight: 600 }}>
              💡 {best.reason}
            </div>
          )}
        </div>
      </div>

      {/* Route cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {analyses.map((a, idx) => {
          const score   = a.weatherScore;
          const isSelected = idx === selectedIdx;
          const isBest  = idx === best.recommended;
          const maxRisk = RISK[score.maxLevel?.toUpperCase()] || RISK.SAFE;
          const color   = weatherRiskColor(score.maxLevel);

          return (
            <button
              key={idx}
              onClick={() => onSelectRoute?.(idx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                background: isSelected ? '#0c1a3a' : '#111827',
                border: `1px solid ${isSelected ? '#3b82f6' : '#1e2d45'}`,
                transition: 'all 0.15s', textAlign: 'left', width: '100%',
                outline: 'none',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = '#2d3f5c'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = '#1e2d45'; }}
            >
              {/* Route label */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: isSelected ? '#1e40af' : '#1a2235',
                border: `2px solid ${isSelected ? '#3b82f6' : '#334155'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: isSelected ? '#fff' : '#94a3b8',
              }}>
                {idx + 1}
              </div>

              {/* Route info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span>⏱ {a.durationMin} min</span>
                  <span>📍 {a.distanceKm} km</span>
                </div>
                {/* Risk badges */}
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
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
                      ✅ All clear
                    </span>
                  )}
                </div>
              </div>

              {/* Max risk level */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontSize: 9, fontWeight: 800, padding: '3px 7px', borderRadius: 4,
                  background: color + '22', color,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {maxRisk.label}
                </div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 3 }}>
                  Score: {score.totalScore}
                </div>
              </div>

              {/* Best badge */}
              {isBest && (
                <div style={{
                  position: 'absolute', top: -8, right: 8,
                  background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                  color: '#fff', fontSize: 8, fontWeight: 800,
                  padding: '2px 7px', borderRadius: 999,
                }}>
                  ★ BEST WEATHER
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Time impact notice */}
      {isBetterRouteAvailable && best.timeDiffMin != null && (
        <div style={{ fontSize: 11, color: '#64748b', paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {best.timeDiffMin > 0
            ? `⏱ Safest route adds ${best.timeDiffMin} min to travel time`
            : best.timeDiffMin < 0
              ? `⚡ Safest route also saves ${Math.abs(best.timeDiffMin)} min`
              : '⏱ Same travel time — better weather'}
          {best.riskImprovement && ` · ${best.riskImprovement}`}
        </div>
      )}
    </motion.div>
  );
}
