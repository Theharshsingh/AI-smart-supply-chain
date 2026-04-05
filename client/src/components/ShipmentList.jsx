import { modeBadgeClass, modeIcon, statusBadgeClass, riskColor } from '../utils';

export default function ShipmentList({ shipments, selected, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {shipments.map(s => {
        const isSelected = selected?.id === s.id;
        return (
          <div
            key={s.id}
            className="card2"
            onClick={() => onSelect(s)}
            style={{
              cursor: 'pointer',
              border: isSelected ? '1px solid #3b82f6' : undefined,
              background: isSelected ? '#0c1a3a' : undefined,
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{s.id}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.cargo} · {s.weight}kg</div>
              </div>
              <span className={`badge ${statusBadgeClass(s.status)}`}>{s.status}</span>
            </div>

            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
              <span style={{ color: '#60a5fa' }}>{s.origin}</span>
              <span style={{ margin: '0 6px', color: '#334155' }}>→</span>
              <span style={{ color: '#a78bfa' }}>{s.destination}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className={`badge ${modeBadgeClass(s.currentMode)}`}>{modeIcon(s.currentMode)} {s.currentMode}</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>ETA {Math.round(s.eta)}h</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="risk-bar-track" style={{ flex: 1 }}>
                <div
                  className="risk-bar-fill"
                  style={{ width: `${s.riskScore}%`, background: riskColor(s.riskScore) }}
                />
              </div>
              <span style={{ fontSize: 11, color: riskColor(s.riskScore), fontWeight: 600, minWidth: 32 }}>
                {s.riskScore}%
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} className="pulse" />
              <span style={{ fontSize: 10, color: '#475569' }}>
                {s.currentLocation.lat.toFixed(3)}, {s.currentLocation.lng.toFixed(3)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
