import { weatherIcon, weatherColor } from '../utils';

function AlertItem({ alert }) {
  const cls = alert.type === 'danger' ? 'alert-danger' : alert.type === 'warning' ? 'alert-warning' : 'alert-info';
  const icon = alert.type === 'danger' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️';
  return (
    <div className={cls} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12, lineHeight: 1.5 }}>{alert.msg}</span>
    </div>
  );
}

export default function AlertsPanel({ env, alerts, shipments = [] }) {
  const trafficPct = Math.round((env.traffic || 0) * 100);
  const trafficColor = trafficPct > 70 ? '#ef4444' : trafficPct > 50 ? '#f59e0b' : '#22c55e';

  // Auto-switched shipments from decision engine
  const autoSwitched = shipments.filter(s => s.autoSwitched && s.autoSwitchReason);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>⚡ Live Conditions</div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div className="card2" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28 }}>{weatherIcon(env.weather)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: weatherColor(env.weather), marginTop: 4 }}>
            {env.weather || 'Clear'}
          </div>
          {env.forecastWorst && env.forecastWorst !== env.weather && (
            <div style={{ fontSize: 10, color: '#64748b' }}>→ {env.forecastWorst} forecast</div>
          )}
          <div style={{ fontSize: 10, color: '#64748b' }}>Weather</div>
        </div>
        <div className="card2" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: trafficColor }}>{trafficPct}%</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Traffic Load</div>
          <div className="risk-bar-track" style={{ marginTop: 6 }}>
            <div className="risk-bar-fill" style={{ width: `${trafficPct}%`, background: trafficColor }} />
          </div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 4 }}>
            {env.apiStatus?.traffic === 'google' ? '📡 Google Maps' : '⏱ Heuristic'}
          </div>
        </div>
      </div>

      {/* Auto-decision engine notifications */}
      {autoSwitched.length > 0 && (
        <>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#64748b' }}>🤖 AUTO-DECISION ENGINE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {autoSwitched.map(s => (
              <div key={s.id} className="alert-warning" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>🔀</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>{s.id}</div>
                  <div style={{ fontSize: 11, color: '#d97706' }}>{s.autoSwitchReason}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ fontWeight: 600, fontSize: 12, color: '#64748b' }}>ACTIVE ALERTS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {alerts && alerts.length > 0
          ? alerts.map((a, i) => <AlertItem key={i} alert={a} />)
          : <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: '12px 0' }}>✅ No active alerts — all routes clear</div>
        }
      </div>

      {env.lastUpdated && (
        <div style={{ fontSize: 10, color: '#334155', textAlign: 'right' }}>
          Updated: {new Date(env.lastUpdated).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
