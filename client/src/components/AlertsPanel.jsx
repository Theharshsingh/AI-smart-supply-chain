import { weatherIcon, weatherColor } from '../utils';

function AlertItem({ alert }) {
  const cls  = alert.type === 'danger' ? 'alert-danger' : alert.type === 'warning' ? 'alert-warning' : 'alert-info';
  const icon = alert.type === 'danger' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️';
  return (
    <div className={cls} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12, lineHeight: 1.5 }}>{alert.msg}</span>
    </div>
  );
}

// ── Speedometer ───────────────────────────────────────────────────────────────
function Speedometer({ speed = 0, isNavigating = false }) {
  const MAX = 120;
  const pct = Math.min(speed / MAX, 1);

  // Arc from -210deg to 30deg (240deg sweep), SVG arc
  const cx = 52, cy = 52, r = 40;
  const startAngle = -210;
  const sweepDeg   = 240;
  const endAngle   = startAngle + sweepDeg * pct;

  function polar(angle, radius = r) {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  const start = polar(startAngle);
  const end   = polar(endAngle);
  const large = sweepDeg * pct > 180 ? 1 : 0;

  // Track arc (full)
  const trackEnd = polar(startAngle + sweepDeg);
  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${trackEnd.x} ${trackEnd.y}`;

  // Fill arc (speed)
  const fillPath = pct > 0
    ? `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`
    : null;

  // Needle tip
  const needleAngle = startAngle + sweepDeg * pct;
  const needleTip   = polar(needleAngle, r - 6);

  const speedColor = speed > 80 ? '#ef4444' : speed > 50 ? '#f59e0b' : '#22c55e';
  const label = isNavigating ? `${speed} km/h` : '— km/h';
  const statusLabel = !isNavigating
    ? 'Start navigation'
    : speed === 0 ? 'Stationary' : speed < 20 ? 'Slow' : speed < 60 ? 'Moving' : 'Fast';

  return (
    <div className="card2" style={{ textAlign: 'center', padding: '10px 8px' }}>
      <svg viewBox="0 0 104 80" width="100%" style={{ maxWidth: 110, display: 'block', margin: '0 auto' }}>
        {/* Track */}
        <path d={trackPath} fill="none" stroke="var(--border)" strokeWidth="7" strokeLinecap="round" />
        {/* Fill */}
        {fillPath && (
          <path d={fillPath} fill="none" stroke={speedColor} strokeWidth="7" strokeLinecap="round"
            style={{ transition: 'stroke 0.4s, d 0.3s' }} />
        )}
        {/* Needle dot */}
        <circle cx={needleTip.x} cy={needleTip.y} r="3.5" fill={speedColor}
          style={{ transition: 'cx 0.3s, cy 0.3s, fill 0.4s' }} />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r="4" fill="var(--tx-3)" />
        {/* Speed value */}
        <text x={cx} y={cy + 16} textAnchor="middle"
          style={{ fontSize: 13, fontWeight: 800, fill: speedColor, fontFamily: 'Inter, sans-serif',
            transition: 'fill 0.4s' }}>
          {isNavigating ? speed : '—'}
        </text>
      </svg>
      <div style={{ fontSize: 10, fontWeight: 700, color: speedColor, marginTop: 2,
        transition: 'color 0.4s' }}>
        {label}
      </div>
      <div style={{ fontSize: 9, color: 'var(--tx-3)', marginTop: 1 }}>{statusLabel}</div>
    </div>
  );
}

export default function AlertsPanel({ env, alerts, shipments = [], speed = 0, isNavigating = false }) {
  const autoSwitched = shipments.filter(s => s.autoSwitched && s.autoSwitchReason);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card-hdr" style={{ marginBottom: 0 }}>
        <div className="card-title">
          <div className="ct-icon">⚡</div>
          Live Conditions
        </div>
        {env.lastUpdated && (
          <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>
            {new Date(env.lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="divider" style={{ margin: '0' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Weather card */}
        <div className="card2" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 26, marginBottom: 4 }}>{weatherIcon(env.weather)}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: weatherColor(env.weather) }}>
            {env.weather || 'Clear'}
          </div>
          {env.forecastWorst && env.forecastWorst !== env.weather && (
            <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 2 }}>→ {env.forecastWorst}</div>
          )}
          <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 2 }}>Weather</div>
        </div>

        {/* Speedometer replaces traffic */}
        <Speedometer speed={speed} isNavigating={isNavigating} />
      </div>

      {autoSwitched.length > 0 && (
        <>
          <div className="sec-lbl">🤖 Auto-Decision Engine</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {autoSwitched.map(s => (
              <div key={s.id} className="alert-warning" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>🔀</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{s.id}</div>
                  <div style={{ fontSize: 11, marginTop: 1 }}>{s.autoSwitchReason}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sec-lbl">Active Alerts</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {alerts?.length > 0
          ? alerts.map((a, i) => <AlertItem key={i} alert={a} />)
          : (
            <div style={{ fontSize: 12, color: 'var(--tx-3)', textAlign: 'center', padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ color: 'var(--green)' }}>✓</span> All routes clear
            </div>
          )
        }
      </div>
    </div>
  );
}
