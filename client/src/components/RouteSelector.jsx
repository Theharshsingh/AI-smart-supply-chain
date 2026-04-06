import { Clock, MapPin, Navigation, Zap, Ruler } from 'lucide-react';

export const ROUTE_COLORS = ['#3b82f6', '#a78bfa', '#22c55e', '#f59e0b'];

function fmtDuration(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDistance(km) {
  const n = parseFloat(km);
  return `${n >= 100 ? Math.round(n) : n} km`;
}

export default function RouteSelector({ routes, selectedIdx, onSelect, fromText, toText }) {
  if (!routes?.length) return null;

  const minDuration = Math.min(...routes.map(r => r.durationMin));
  const minDistance = Math.min(...routes.map(r => parseFloat(r.distanceKm)));

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* ── Header ── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1e2d45',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Navigation size={14} color="#3b82f6" strokeWidth={2.5} />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>Route Options</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {fromText && toText && (
            <span style={{ fontSize: 10, color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fromText.split(',')[0]} → {toText.split(',')[0]}
            </span>
          )}
          <span style={{
            background: '#1a2235', color: '#64748b', fontSize: 10, fontWeight: 700,
            padding: '2px 8px', borderRadius: 999, letterSpacing: '0.04em',
          }}>
            {routes.length} routes
          </span>
        </div>
      </div>

      {/* ── Route list ── */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {routes.map((route, idx) => {
          const isFastest = route.durationMin === minDuration;
          const isShortest = parseFloat(route.distanceKm) === minDistance && !isFastest;
          const isSelected = idx === selectedIdx;
          const color = ROUTE_COLORS[idx] || '#64748b';
          const timeDiff = route.durationMin - minDuration;

          return (
            <div
              key={idx}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`Route ${idx + 1} via ${route.viaName}, ${fmtDistance(route.distanceKm)}, ${fmtDuration(route.durationMin)}`}
              onClick={() => onSelect(idx)}
              onKeyDown={e => e.key === 'Enter' && onSelect(idx)}
              style={{
                padding: '14px 16px',
                borderBottom: idx < routes.length - 1 ? '1px solid #161e2e' : 'none',
                background: isSelected ? '#0d1f3c' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                borderLeft: `3px solid ${isSelected ? color : 'transparent'}`,
                outline: 'none',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#131f35'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* ── Color indicator dot ── */}
              <div style={{
                width: 13, height: 13, borderRadius: '50%',
                background: isSelected ? color : 'transparent',
                border: `2.5px solid ${color}`,
                flexShrink: 0, marginTop: 3,
                boxShadow: isSelected ? `0 0 10px ${color}66` : 'none',
                transition: 'all 0.15s',
              }} />

              {/* ── Route info ── */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Badges */}
                <div style={{ display: 'flex', gap: 5, marginBottom: 5, flexWrap: 'wrap' }}>
                  {isFastest && (
                    <span style={{
                      background: '#052e16', color: '#4ade80', border: '1px solid #166534',
                      borderRadius: 4, fontSize: 9, fontWeight: 700, padding: '2px 7px',
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                    }}>
                      <Zap size={9} strokeWidth={2.5} />Fastest
                    </span>
                  )}
                  {isShortest && (
                    <span style={{
                      background: '#0c1a3a', color: '#60a5fa', border: '1px solid #1e40af',
                      borderRadius: 4, fontSize: 9, fontWeight: 700, padding: '2px 7px',
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                    }}>
                      <Ruler size={9} strokeWidth={2.5} />Shorter
                    </span>
                  )}
                  {!isFastest && timeDiff > 0 && (
                    <span style={{
                      background: '#1a2235', color: '#475569', borderRadius: 4,
                      fontSize: 9, fontWeight: 600, padding: '2px 7px',
                    }}>
                      +{fmtDuration(timeDiff)} slower
                    </span>
                  )}
                </div>

                {/* Via label */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: isSelected ? '#94a3b8' : '#475569', marginBottom: 7,
                }}>
                  <MapPin size={9} strokeWidth={2} color={isSelected ? color : '#334155'} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    via {route.viaName || 'main road'}
                  </span>
                </div>

                {/* Distance + Duration */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{
                    fontSize: 18, fontWeight: 800,
                    color: isSelected ? color : '#e2e8f0',
                    lineHeight: 1, transition: 'color 0.15s',
                  }}>
                    {fmtDuration(route.durationMin)}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#64748b' }}>
                    <Clock size={10} strokeWidth={2} />
                    <span style={{ fontSize: 11, fontWeight: 500 }}>{fmtDistance(route.distanceKm)}</span>
                  </div>
                </div>
              </div>

              {/* ── Radio circle ── */}
              <div style={{
                width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${isSelected ? color : '#334155'}`,
                background: isSelected ? color : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 2, transition: 'all 0.15s',
              }}>
                {isSelected && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer hint ── */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid #161e2e',
        fontSize: 10, color: '#334155', textAlign: 'center',
      }}>
        Click a route to highlight it on the map
      </div>
    </div>
  );
}
