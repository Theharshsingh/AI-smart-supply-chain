import { useState, useEffect, useRef } from 'react';
import { Trash2, Eye, Square, MapPin, Clock, CheckCircle, XCircle, Loader, Navigation, QrCode, Link, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}

function StatusBadge({ status }) {
  const map = {
    ongoing:   { bg: '#052e16', color: '#4ade80', border: '#166534', icon: <Loader size={10} />,      label: 'Ongoing' },
    completed: { bg: '#0c1a3a', color: '#60a5fa', border: '#1e40af', icon: <CheckCircle size={10} />, label: '✅ Delivered' },
    cancelled: { bg: '#450a0a', color: '#f87171', border: '#991b1b', icon: <XCircle size={10} />,     label: 'Cancelled' },
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

// ── Per-shipment GPS tracker ──────────────────────────────────────────────────
function useGpsDistance(toLat, toLon, active) {
  const [distM, setDistM] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const watchRef = useRef(null);

  useEffect(() => {
    if (!active || !toLat || !toLon || !navigator.geolocation) return;

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const d = haversine(pos.coords.latitude, pos.coords.longitude, toLat, toLon);
        setDistM(Math.round(d));
        setGpsError(null);
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [active, toLat, toLon]);

  return { distM, gpsError };
}

// ── QR Code + Tracking Link Modal ───────────────────────────────────────────
function QRModal({ shipment, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!shipment) return null;

  const trackingUrl = (() => {
    // Encode shipment data directly in URL so any device can open it
    const payload = {
      id: shipment.id,
      from: shipment.from,
      to: shipment.to,
      toLat: shipment.toLat,
      toLon: shipment.toLon,
      distanceKm: shipment.distanceKm,
      durationMin: shipment.durationMin,
      status: shipment.status,
      startTime: shipment.startTime,
      endTime: shipment.endTime,
      trackingToken: shipment.trackingToken,
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    return `${window.location.origin}${window.location.pathname}?tracking=${encoded}`;
  })();

  function copyLink() {
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: 28, width: '100%', maxWidth: 380,
        boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>📦 Track Shipment</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Share this with your customer</div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#64748b', cursor: 'pointer', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* QR Code */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}>
          <QRCodeSVG
            value={trackingUrl}
            size={200}
            bgColor="#ffffff"
            fgColor="#0f172a"
            level="M"
            includeMargin={false}
          />
        </div>

        {/* Tracking ID */}
        <div style={{
          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 14, textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginBottom: 4 }}>TRACKING ID</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', letterSpacing: '0.05em' }}>
            {shipment.trackingToken}
          </div>
        </div>

        {/* Route summary */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
            <span style={{ color: '#22c55e' }}>●</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shipment.from?.split(',')[0]}</span>
          </div>
          <div style={{ width: 2, height: 10, background: 'rgba(255,255,255,0.1)', margin: '3px 0 3px 5px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
            <span style={{ color: '#ef4444' }}>●</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shipment.to?.split(',')[0]}</span>
          </div>
        </div>

        {/* Copy link button */}
        <button onClick={copyLink} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: copied ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#3b82f6,#2563eb)',
          border: 'none', borderRadius: 12, padding: '12px 20px',
          color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          transition: 'all 0.25s', boxShadow: copied ? '0 4px 16px rgba(34,197,94,0.3)' : '0 4px 16px rgba(59,130,246,0.3)',
        }}>
          {copied ? <><Check size={15} /> Link Copied!</> : <><Copy size={15} /> Copy Tracking Link</>}
        </button>

        <div style={{ fontSize: 10, color: '#334155', textAlign: 'center', marginTop: 12 }}>
          Customer can scan QR or open the link to track live
        </div>
      </div>
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
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
              <span style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>{shipment.from}</span>
            </div>
            <div style={{ width: 2, height: 16, background: '#1e2d45', margin: '4px 0 4px 7px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>🔴</span>
              <span style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>{shipment.to}</span>
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
        </div>
      </div>
    </div>
  );
}

// ── Single shipment card with live GPS tracking ───────────────────────────────
function ShipmentCard({ s, onStop, onDelete, onComplete, onViewDetail, onShowQR }) {
  const isOngoing = s.status === 'ongoing';
  const { distM, gpsError } = useGpsDistance(s.toLat, s.toLon, isOngoing);
  const nearDest = distM != null && distM <= 500;

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
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

          <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} color="#475569" />
              <span style={{ fontSize: 10, color: '#64748b' }}>{fmtTime(s.startTime)}</span>
            </div>
            <span style={{ fontSize: 10, color: '#334155' }}>
              Duration: {fmtDuration(s.startTime, s.endTime)}
            </span>
          </div>

          {/* Live distance to destination */}
          {isOngoing && (
            <div style={{ marginTop: 8 }}>
              {gpsError ? (
                <span style={{ fontSize: 10, color: '#f87171', background: '#450a0a', border: '1px solid #991b1b', borderRadius: 4, padding: '2px 8px' }}>
                  📡 GPS Error
                </span>
              ) : distM == null ? (
                <span style={{ fontSize: 10, color: '#f59e0b', background: '#422006', border: '1px solid #92400e', borderRadius: 4, padding: '2px 8px' }}>
                  📡 Acquiring GPS…
                </span>
              ) : (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                  background: nearDest ? '#052e16' : '#0a0e1a',
                  color: nearDest ? '#4ade80' : '#60a5fa',
                  border: `1px solid ${nearDest ? '#166534' : '#1e40af'}`,
                }}>
                  📍 {fmtDist(distM)} to destination {nearDest ? '✅ Near!' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => onShowQR(s)}
            title="Show QR code & tracking link"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 6, padding: '5px 10px', color: '#a78bfa',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <QrCode size={12} /> QR / Share
          </button>

          <button
            onClick={() => onViewDetail(s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#0c1a3a', border: '1px solid #1e40af',
              borderRadius: 6, padding: '5px 10px', color: '#60a5fa',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Eye size={12} /> Details
          </button>

          {/* Reached Location button — enabled only within 500m */}
          {isOngoing && (
            <button
              onClick={() => nearDest && onComplete(s.id)}
              disabled={!nearDest}
              title={nearDest ? 'Mark as delivered' : `Get within 500m of destination (currently ${fmtDist(distM) || 'locating…'})`}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: nearDest ? 'linear-gradient(135deg,#15803d,#166534)' : '#1a2235',
                border: `1px solid ${nearDest ? '#22c55e' : '#334155'}`,
                borderRadius: 6, padding: '5px 10px',
                color: nearDest ? '#fff' : '#475569',
                fontSize: 11, fontWeight: 700,
                cursor: nearDest ? 'pointer' : 'not-allowed',
                opacity: nearDest ? 1 : 0.6,
                boxShadow: nearDest ? '0 0 12px #22c55e44' : 'none',
                transition: 'all 0.3s',
              }}
            >
              <Navigation size={12} />
              {nearDest ? '✅ Reached!' : 'Reached Location'}
            </button>
          )}

          {isOngoing && (
            <button
              onClick={() => onStop(s.id)}
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
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function ShipmentDashboard({ history, onStop, onDelete, onComplete }) {
  const [detail, setDetail] = useState(null);
  const [qrShipment, setQrShipment] = useState(null);
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
      <QRModal shipment={qrShipment} onClose={() => setQrShipment(null)} />

      {/* Header + filters */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9' }}>📦 My Shipments</div>
          <span style={{ fontSize: 11, color: '#475569' }}>{history.length} total</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: '#475569' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 13 }}>No shipments yet. Plan a route and start a shipment!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(s => (
            <ShipmentCard
              key={s.id}
              s={s}
              onStop={onStop}
              onDelete={onDelete}
              onComplete={onComplete}
              onViewDetail={setDetail}
              onShowQR={setQrShipment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
