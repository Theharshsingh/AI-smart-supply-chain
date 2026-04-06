import { modeBadgeClass, modeIcon, statusBadgeClass, riskColor } from '../utils';

export default function ShipmentList({ shipments, selected, onSelect }) {
  if (!shipments.length) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--tx-3)', fontSize: 12 }}>
        No active shipments
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {shipments.map(s => {
        const isSelected = selected?.id === s.id;
        return (
          <div
            key={s.id}
            onClick={() => onSelect(s)}
            style={{
              background: isSelected ? 'var(--blue-50)' : 'var(--bg-sub)',
              border: `1.5px solid ${isSelected ? 'var(--blue)' : 'var(--border)'}`,
              borderRadius: 'var(--r-md)',
              padding: '11px 12px',
              cursor: 'pointer',
              transition: 'all .15s',
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-md)'; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--tx-1)' }}>{s.id}</div>
                <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 1 }}>{s.cargo} · {s.weight}kg</div>
              </div>
              <span className={`badge ${statusBadgeClass(s.status)}`}>{s.status}</span>
            </div>

            <div style={{ fontSize: 12, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--blue)', fontWeight: 500 }}>{s.origin}</span>
              <span style={{ color: 'var(--tx-3)' }}>→</span>
              <span style={{ color: 'var(--tx-2)', fontWeight: 500 }}>{s.destination}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <span className={`badge ${modeBadgeClass(s.currentMode)}`}>{modeIcon(s.currentMode)} {s.currentMode}</span>
              <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>ETA {Math.round(s.eta)}h</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="risk-bar-track" style={{ flex: 1 }}>
                <div className="risk-bar-fill" style={{ width: `${s.riskScore}%`, background: riskColor(s.riskScore) }} />
              </div>
              <span style={{ fontSize: 11, color: riskColor(s.riskScore), fontWeight: 700, minWidth: 32 }}>
                {s.riskScore}%
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} className="pulse" />
              <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>
                {s.currentLocation.lat.toFixed(3)}, {s.currentLocation.lng.toFixed(3)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
