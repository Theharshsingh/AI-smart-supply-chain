import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * WeatherAlertBanner
 * Shows a dismissable summary banner + expandable alert list when
 * weather risks are detected along the planned route.
 * Resets automatically when `routeKey` changes (new route).
 */
export default function WeatherAlertBanner({
  severeCount,
  moderateCount,
  lightCount = 0,
  routeAlerts = [],
  loading,
  routeKey,
}) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded,  setExpanded]  = useState(false);

  useEffect(() => { setDismissed(false); setExpanded(false); }, [routeKey]);

  if (loading || dismissed) return null;
  if (!severeCount && !moderateCount && !lightCount) return null;

  const isSevere    = severeCount > 0;
  const borderColor = isSevere ? 'rgba(239,68,68,0.4)' : moderateCount ? 'rgba(245,158,11,0.4)' : 'rgba(132,204,22,0.4)';
  const bgColor     = isSevere ? 'rgba(239,68,68,0.08)' : moderateCount ? 'rgba(245,158,11,0.08)' : 'rgba(132,204,22,0.08)';
  const headColor   = isSevere ? '#f87171' : moderateCount ? '#fcd34d' : '#bef264';
  const icon        = isSevere ? '⛈️' : moderateCount ? '⚠️' : '⚡';

  const countLabel = [
    severeCount   > 0 && `${severeCount} high-risk`,
    moderateCount > 0 && `${moderateCount} medium-risk`,
    lightCount    > 0 && `${lightCount} light-risk`,
  ].filter(Boolean).join(', ') + ` segment${(severeCount + moderateCount + lightCount) > 1 ? 's' : ''}`;

  const hasAlerts = routeAlerts?.length > 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 10, overflow: 'hidden' }}
      >
        {/* ── Summary row ── */}
        <div style={{ padding: '10px 12px 10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>{icon}</span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: headColor, lineHeight: 1.3 }}>
              {isSevere
                ? '🚨 High weather risk detected on your route'
                : moderateCount
                  ? '⚠️ Medium weather risk on your route'
                  : '⚡ Light weather risk on your route'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{countLabel}</div>
          </div>

          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {hasAlerts && (
              <button
                onClick={() => setExpanded(x => !x)}
                aria-label={expanded ? 'Collapse alerts' : 'Expand alerts'}
                style={{
                  background: 'none', border: 'none', color: '#64748b',
                  cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss weather alert"
              style={{
                background: 'none', border: 'none', color: '#475569',
                cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Expanded alert list ── */}
        <AnimatePresence>
          {expanded && hasAlerts && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden', borderTop: `1px solid ${borderColor}` }}
            >
              <div style={{ padding: '8px 14px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {routeAlerts.map((a, i) => {
                  const ac = a.level === 'high' ? '#f87171' : a.level === 'medium' ? '#fcd34d' : '#bef264';
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 11, color: ac, flexShrink: 0, marginTop: 1 }}>
                        {a.level === 'high' ? '🚨' : a.level === 'medium' ? '⚠️' : '⚡'}
                      </span>
                      <div>
                        <div style={{ fontSize: 11, color: '#f1f5f9', fontWeight: 600 }}>{a.message}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{a.detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
