import { useState, useEffect } from 'react';
import { fetchRoutes, switchRoute } from '../api';
import { riskColor, fmtEta, modeIcon } from '../utils';
import toast from 'react-hot-toast';

function SegmentPill({ mode }) {
  const colors = { ROAD: '#22c55e', TRAIN: '#60a5fa', AIR: '#a78bfa' };
  return (
    <span style={{
      background: colors[mode] + '22', color: colors[mode],
      border: `1px solid ${colors[mode]}44`,
      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
    }}>
      {modeIcon(mode)} {mode}
    </span>
  );
}

export default function RoutePanel({ shipment, onRouteSwitch }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(null);

  useEffect(() => {
    if (!shipment) return;
    setLoading(true);
    fetchRoutes(shipment.id).then(r => { setRoutes(r); setLoading(false); });
  }, [shipment?.id]);

  async function handleSwitch(routeId) {
    setSwitching(routeId);
    await switchRoute(shipment.id, routeId);
    setSwitching(null);
    toast.success(`Switched to ${routes.find(r => r.id === routeId)?.label}`, { icon: '🔀' });
    onRouteSwitch?.();
    fetchRoutes(shipment.id).then(setRoutes);
  }

  if (!shipment) return (
    <div className="card" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#475569' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🗺️</div>
        <div style={{ fontSize: 13 }}>Select a shipment to view route options</div>
      </div>
    </div>
  );

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Multi-Modal Routes</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{shipment.origin} → {shipment.destination}</div>
        </div>
        <span style={{ fontSize: 11, color: '#475569', background: '#1a2235', padding: '4px 10px', borderRadius: 6 }}>
          {shipment.id}
        </span>
      </div>

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="shimmer" style={{ height: 100, borderRadius: 10 }} />
        ))
      ) : (
        routes.map(route => (
          <div
            key={route.id}
            className="card2"
            style={{
              border: route.recommended ? '1px solid #3b82f6' : undefined,
              position: 'relative',
            }}
          >
            {route.recommended && (
              <div style={{
                position: 'absolute', top: -10, right: 12,
                background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                color: 'white', fontSize: 10, fontWeight: 700,
                padding: '2px 10px', borderRadius: 999,
              }}>
                ⭐ BEST ROUTE
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{route.label}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {route.modes.map(m => <SegmentPill key={m} mode={m} />)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: '#64748b' }}>ETA</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{fmtEta(route.eta)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748b' }}>RISK</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: riskColor(route.risk) }}>{route.risk}%</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>RISK LEVEL</div>
                <div className="risk-bar-track">
                  <div className="risk-bar-fill" style={{ width: `${route.risk}%`, background: riskColor(route.risk) }} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              {route.reasons.map((r, i) => (
                <div key={i} style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#475569' }}>•</span> {r}
                </div>
              ))}
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', opacity: switching === route.id ? 0.6 : 1 }}
              onClick={() => handleSwitch(route.id)}
              disabled={switching === route.id}
            >
              {switching === route.id ? 'Switching...' : '🔀 Switch to This Route'}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
