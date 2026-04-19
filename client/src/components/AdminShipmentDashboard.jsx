import { useState } from 'react';
import { MapPin, Clock, Truck, CheckCircle, XCircle, Loader, Eye, Navigation } from 'lucide-react';

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

function fmtDist(m) {
  if (m == null) return null;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    ongoing:   { bg: 'rgba(34,197,94,0.1)',  color: '#4ade80', border: 'rgba(34,197,94,0.3)',  icon: <Loader size={10} className="spin" />, label: 'In Transit' },
    completed: { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)', icon: <CheckCircle size={10} />,            label: 'Delivered' },
    cancelled: { bg: 'rgba(239,68,68,0.1)',  color: '#f87171', border: 'rgba(239,68,68,0.3)',  icon: <XCircle size={10} />,               label: 'Cancelled' },
  };
  const s = map[status] || map.cancelled;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 700,
    }}>
      {s.icon} {s.label}
    </span>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ shipment, onClose }) {
  if (!shipment) return null;

  const distToDestM = shipment.currentLat && shipment.toLat
    ? Math.round(haversine(shipment.currentLat, shipment.currentLng, shipment.toLat, shipment.toLon))
    : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: 24, width: '100%', maxWidth: 460,
        boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>📦 Order Details</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* Driver info */}
        <div style={{
          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 12, padding: '12px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 28 }}>🚛</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{shipment.driverName}</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Driver</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <StatusBadge status={shipment.status} />
          </div>
        </div>

        {/* Route */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>Route</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>{shipment.from}</span>
          </div>
          <div style={{ width: 2, height: 14, background: 'rgba(255,255,255,0.1)', margin: '0 0 6px 3px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>{shipment.to}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Started',      value: fmtTime(shipment.startTime) },
            { label: 'Duration',     value: fmtDuration(shipment.startTime, shipment.endTime), color: '#60a5fa' },
            { label: 'Distance',     value: shipment.distanceKm ? `${shipment.distanceKm} km` : '—', color: '#22c55e' },
            { label: 'Est. Time',    value: shipment.durationMin ? `${shipment.durationMin} min` : '—', color: '#a78bfa' },
            { label: 'Completed',    value: fmtTime(shipment.endTime) },
            { label: 'Dist to Dest', value: distToDestM != null ? fmtDist(distToDestM) : '—', color: distToDestM != null && distToDestM <= 500 ? '#4ade80' : '#60a5fa' },
          ].map(item => (
            <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: item.color || '#f1f5f9' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Live GPS */}
        {shipment.currentLat && (
          <div style={{
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 10, padding: '10px 14px', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s infinite' }} />
            <div>
              <span style={{ color: '#4ade80', fontWeight: 600 }}>Live GPS: </span>
              <span style={{ color: '#94a3b8' }}>{shipment.currentLat.toFixed(4)}, {shipment.currentLng.toFixed(4)}</span>
              {shipment.locationUpdatedAt && (
                <span style={{ color: '#334155', marginLeft: 8 }}>· {fmtTime(shipment.locationUpdatedAt)}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single Order Card ─────────────────────────────────────────────────────────
function OrderCard({ s, onViewDetail }) {
  const isOngoing = s.status === 'ongoing';

  const distToDestM = s.currentLat && s.toLat
    ? Math.round(haversine(s.currentLat, s.currentLng, s.toLat, s.toLon))
    : null;

  const nearDest = distToDestM != null && distToDestM <= 500;
  const hasLiveGps = isOngoing && s.currentLat;

  // How long ago was GPS updated
  const gpsAge = s.locationUpdatedAt
    ? Math.round((Date.now() - new Date(s.locationUpdatedAt)) / 1000)
    : null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${isOngoing ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 14, padding: '14px 16px',
      transition: 'all 0.2s',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Driver + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>🚛 {s.driverName}</span>
            <StatusBadge status={s.status} />
            {s.distanceKm && (
              <span style={{ fontSize: 10, color: '#475569', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 4 }}>
                {s.distanceKm} km
              </span>
            )}
          </div>

          {/* Route */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.from?.split(',')[0]}
            </span>
          </div>
          <div style={{ width: 2, height: 8, background: 'rgba(255,255,255,0.1)', margin: '0 0 3px 2.5px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.to?.split(',')[0]}
            </span>
          </div>
        </div>

        {/* View detail button */}
        <button
          onClick={() => onViewDetail(s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: 8, padding: '6px 12px', color: '#60a5fa',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Eye size={12} /> Details
        </button>
      </div>

      {/* Bottom info row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#475569' }}>
          <Clock size={10} />
          <span style={{ fontSize: 10 }}>{fmtTime(s.startTime)}</span>
        </div>

        <span style={{ fontSize: 10, color: '#334155' }}>
          {fmtDuration(s.startTime, s.endTime)}
        </span>

        {/* Live GPS status */}
        {isOngoing && (
          hasLiveGps ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              background: nearDest ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.1)',
              color: nearDest ? '#4ade80' : '#60a5fa',
              border: `1px solid ${nearDest ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.2)'}`,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: nearDest ? '#4ade80' : '#60a5fa', animation: 'pulse 2s infinite' }} />
              {nearDest ? '🎉 Almost there!' : `${fmtDist(distToDestM)} to dest`}
              {gpsAge != null && <span style={{ opacity: 0.6 }}>· {gpsAge}s ago</span>}
            </span>
          ) : (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 6,
              background: 'rgba(245,158,11,0.1)', color: '#fcd34d',
              border: '1px solid rgba(245,158,11,0.2)',
            }}>
              📡 Waiting for GPS…
            </span>
          )
        )}

        {/* Completed time */}
        {s.status === 'completed' && s.endTime && (
          <span style={{ fontSize: 10, color: '#4ade80' }}>
            ✅ Delivered {fmtTime(s.endTime)}
          </span>
        )}

        {/* Cancelled time */}
        {s.status === 'cancelled' && s.endTime && (
          <span style={{ fontSize: 10, color: '#f87171' }}>
            ❌ Cancelled {fmtTime(s.endTime)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main AdminShipmentDashboard ───────────────────────────────────────────────
export default function AdminShipmentDashboard({ driverShipments = [] }) {
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState('');

  const counts = {
    all:       driverShipments.length,
    ongoing:   driverShipments.filter(s => s.status === 'ongoing').length,
    completed: driverShipments.filter(s => s.status === 'completed').length,
    cancelled: driverShipments.filter(s => s.status === 'cancelled').length,
  };

  const filtered = driverShipments
    .filter(s => filter === 'all' || s.status === filter)
    .filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        s.driverName?.toLowerCase().includes(q) ||
        s.from?.toLowerCase().includes(q) ||
        s.to?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q)
      );
    })
    // Sort: ongoing first, then by startTime desc
    .sort((a, b) => {
      if (a.status === 'ongoing' && b.status !== 'ongoing') return -1;
      if (b.status === 'ongoing' && a.status !== 'ongoing') return 1;
      return new Date(b.startTime) - new Date(a.startTime);
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <DetailModal shipment={detail} onClose={() => setDetail(null)} />

      {/* Header */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--tx-1)' }}>📦 All Orders</div>
            <div style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 3 }}>
              {counts.ongoing} in transit · {counts.completed} delivered · {counts.cancelled} cancelled
            </div>
          </div>
          {/* Live indicator */}
          {counts.ongoing > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'livepulse 2s infinite' }} />
              <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>{counts.ongoing} Live</span>
            </div>
          )}
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search by driver, location, order ID..."
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
            padding: '9px 14px', color: 'var(--tx-1)', fontSize: 13,
            outline: 'none', fontFamily: 'inherit', marginBottom: 12,
            boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = '#3b82f6'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
        />

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'all',       label: 'All',        color: '#60a5fa' },
            { key: 'ongoing',   label: '🚛 In Transit', color: '#4ade80' },
            { key: 'completed', label: '✅ Delivered',  color: '#60a5fa' },
            { key: 'cancelled', label: '❌ Cancelled',  color: '#f87171' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              background: filter === f.key ? f.color + '22' : 'transparent',
              border: `1px solid ${filter === f.key ? f.color : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 8, padding: '5px 14px', fontSize: 12, fontWeight: 600,
              color: filter === f.key ? f.color : 'var(--tx-3)', cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              {f.label}
              {counts[f.key] > 0 && (
                <span style={{ marginLeft: 5, opacity: 0.7 }}>({counts[f.key]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Order list */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tx-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            {driverShipments.length === 0 ? 'No orders yet' : 'No orders match this filter'}
          </div>
          <div style={{ fontSize: 12 }}>
            {driverShipments.length === 0
              ? 'Orders will appear here when drivers start shipments'
              : 'Try a different filter or search term'
            }
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(s => (
            <OrderCard key={s.id} s={s} onViewDetail={setDetail} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes livepulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(34,197,94,.5)} 50%{opacity:.9;box-shadow:0 0 0 5px rgba(34,197,94,0)} }
      `}</style>
    </div>
  );
}
