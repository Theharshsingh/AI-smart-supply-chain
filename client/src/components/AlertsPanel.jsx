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

export default function AlertsPanel({ env, alerts, shipments = [] }) {
  const trafficPct   = Math.round((env.traffic || 0) * 100);
  const trafficColor = trafficPct > 70 ? 'var(--red)' : trafficPct > 50 ? 'var(--amber)' : 'var(--green)';
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

        <div className="card2" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: trafficColor, marginBottom: 4 }}>{trafficPct}%</div>
          <div style={{ fontSize: 10, color: 'var(--tx-3)', marginBottom: 6 }}>Traffic Load</div>
          <div className="risk-bar-track">
            <div className="risk-bar-fill" style={{ width: `${trafficPct}%`, background: trafficColor }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 4 }}>
            {env.apiStatus?.traffic === 'google' ? '📡 Google Maps' : '⏱ Heuristic'}
          </div>
        </div>
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
