import { useState } from 'react';
import { Trash2, Eye, Square, MapPin, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(start, end) {
  if (!start) return '—';
  const ms = new Date(end || Date.now()) - new Date(start);
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function StatusBadge({ status }) {
  const map = {
    ongoing:   { bg: '#052e16', color: '#4ade80', border: '#166534', icon: <Loader size={10} />,       label: 'Ongoing' },
    completed: { bg: '#0c1a3a', color: '#60a5fa', border: '#1e40af', icon: <CheckCircle size={10} />,  label: '✅ Delivered' },
    cancelled: { bg: '#450a0a', color: '#f87171', border: '#991b1b', icon: <XCircle size={10} />,      label: 'Cancelled' },
  };
  const s = map[status] || map.cancelled;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
    }}>
      {s.icon} {s.label}
    </span>
  );
}

function DetailModal({ shipment, onClose }) {
  if (!shipment) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#111827', border: '1px solid #1e2d45', borderRadius: 16,
        padding: 24, minWidth: 340, maxWidth: 480, width: '90%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9' }}>📦 Shipment Details</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#0a0e1a', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>Route</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>🟢</span>
              <span style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600, flex: 1 }}>{shipment.from}</span>
            </div>
            <div style={{ width: 2, height: 16, background: '#1e2d45', margin: '4px 0 4px 7px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>🔴</span>
              <span style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600, flex: 1 }}>{shipment.to}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Status',    value: <StatusBadge status={shipment.status} /> },
              { label: 'Duration',  value: fmtDuration(shipment.startTime, shipment.endTime), color: '#60a5fa' },
              { label: 'Start',     value: fmtTime(shipment.startTime), color: '#94a3b8' },
              { label: 'End',       value: fmtTime(shipment.endTime), color: '#94a3b8' },
              { label: 'Distance',  value: shipment.distanceKm ? `${shipment.distanceKm} km` : '—', color: '#22c55e' },
              { label: 'Est. Time', value: shipment.durationMin ? `${shipment.durationMin} min` : '—', color: '#a78bfa' },
            ].map(item => (
              <div key={item.label} style={{ background: '#0a0e1a', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: item.color || '#f1f5f9' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {shipment.routeIdx != null && (
            <div style={{ background: '#0a0e1a', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>Selected Route</div>
              <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>Route {shipment.routeIdx + 1}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShipmentDashboard({ history, onStop, onDelete }) {
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState('all');

  const filtered = history.filter(s => filter === 'all' || s.status === filter);
  const counts = {
    all: history.length,
    ongoing: history.filter(s => s.status === 'ongoing').length,
    completed: history.filter(s => s.status === 'completed').length,
    cancelled: history.filter(s => s.status === 'cancelled').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <DetailModal shipment={detail} onClose={() => setDetail(null)} />

      {/* ── Header + filter tabs ── */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9' }}>📦 My Shipments</div>
          <span style={{ fontSize: 11, color: '#475569' }}>{history.length} total</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'all',       label: 'All',       color: '#60a5fa' },
            { key: 'ongoing',   label: 'Ongoing',   color: '#4ade80' },
            { key: 'completed', label: 'Completed', color: '#60a5fa' },
            { key: 'cancelled', label: 'Cancelled', color: '#f87171' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              background: filter === f.key ? f.color + '22' : 'transparent',
              border: `1px solid ${filter === f.key ? f.color : '#1e2d45'}`,
              borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600,
              color: filter === f.key ? f.color : '#475569', cursor: 'pointer',
            }}>
              {f.label} {counts[f.key] > 0 && <span style={{ opacity: 0.7 }}>({counts[f.key]})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Shipment list ── */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: '#475569' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 13 }}>No shipments yet. Plan a route and start a shipment!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(s => (
            <div key={s.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>

                {/* Route info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <StatusBadge status={s.status} />
                    {s.distanceKm && (
                      <span style={{ fontSize: 10, color: '#475569', background: '#1a2235', padding: '2px 7px', borderRadius: 4 }}>
                        {s.distanceKm} km
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <MapPin size={11} color="#22c55e" />
                    <span style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.from?.split(',')[0]}
                    </span>
                  </div>
                  <div style={{ width: 2, height: 10, background: '#1e2d45', margin: '0 0 3px 5px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={11} color="#ef4444" />
                    <span style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.to?.split(',')[0]}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} color="#475569" />
                      <span style={{ fontSize: 10, color: '#64748b' }}>{fmtTime(s.startTime)}</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#334155' }}>
                      Duration: {fmtDuration(s.startTime, s.endTime)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => setDetail(s)}
                    title="View details"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: '#0c1a3a', border: '1px solid #1e40af',
                      borderRadius: 6, padding: '5px 10px', color: '#60a5fa',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <Eye size={12} /> Details
                  </button>

                  {s.status === 'ongoing' && (
                    <button
                      onClick={() => onStop(s.id)}
                      title="Stop shipment"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: '#422006', border: '1px solid #92400e',
                        borderRadius: 6, padding: '5px 10px', color: '#fb923c',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <Square size={11} fill="#fb923c" /> Stop
                    </button>
                  )}

                  <button
                    onClick={() => onDelete(s.id)}
                    title="Delete shipment"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: '#450a0a', border: '1px solid #991b1b',
                      borderRadius: 6, padding: '5px 10px', color: '#f87171',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
