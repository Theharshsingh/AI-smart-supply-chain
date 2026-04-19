import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { CheckCircle, Clock, MapPin, Package, Truck, XCircle } from 'lucide-react';

const STORAGE_KEY = 'shipment_history';

function loadShipmentByToken(token) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return all.find(s => s.trackingToken === token) || null;
  } catch { return null; }
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

function destIcon() {
  return L.divIcon({
    html: `<div style="width:32px;height:32px;background:#ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid #fff;box-shadow:0 0 12px #ef444488;">📍</div>`,
    className: '', iconSize: [32, 32], iconAnchor: [16, 16],
  });
}

const STATUS_CONFIG = {
  ongoing:   { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)',   label: 'In Transit',  icon: Truck },
  completed: { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)',  label: 'Delivered',   icon: CheckCircle },
  cancelled: { color: '#f87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   label: 'Cancelled',   icon: XCircle },
};

// Timeline steps
function Timeline({ status, startTime, endTime }) {
  const steps = [
    { key: 'created',   label: 'Shipment Created',  icon: '📦', done: true,                          time: startTime },
    { key: 'picked',    label: 'Picked Up',          icon: '🚛', done: true,                          time: startTime },
    { key: 'transit',   label: 'In Transit',         icon: '🛣️', done: status !== 'cancelled',        time: status !== 'cancelled' ? startTime : null },
    { key: 'delivered', label: status === 'cancelled' ? 'Cancelled' : 'Delivered',
                                                      icon: status === 'cancelled' ? '❌' : '✅',
                                                      done: status === 'completed' || status === 'cancelled',
                                                      time: endTime },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {steps.map((step, i) => (
        <div key={step.key} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Icon + line */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: step.done ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
              border: `2px solid ${step.done ? '#22c55e' : 'rgba(255,255,255,0.1)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, transition: 'all 0.3s',
              boxShadow: step.done ? '0 0 12px rgba(34,197,94,0.2)' : 'none',
            }}>
              {step.icon}
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: 2, height: 28,
                background: step.done ? 'linear-gradient(180deg, #22c55e, rgba(34,197,94,0.3))' : 'rgba(255,255,255,0.06)',
                margin: '3px 0',
              }} />
            )}
          </div>
          {/* Text */}
          <div style={{ paddingBottom: i < steps.length - 1 ? 0 : 0, paddingTop: 6 }}>
            <div style={{
              fontSize: 13, fontWeight: step.done ? 700 : 500,
              color: step.done ? '#f1f5f9' : '#475569',
            }}>{step.label}</div>
            {step.time && (
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{fmtTime(step.time)}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TrackingPage() {
  const [shipment, setShipment] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-refresh every 10s for ongoing shipments
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setNotFound(true); return; }

    function refresh() {
      const s = loadShipmentByToken(token);
      if (!s) setNotFound(true);
      else setShipment(s);
    }

    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const cfg = shipment ? (STATUS_CONFIG[shipment.status] || STATUS_CONFIG.cancelled) : null;

  // ── Not found ──
  if (notFound) return (
    <div style={{
      minHeight: '100vh', background: '#020817', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ textAlign: 'center', color: '#f1f5f9' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>📦</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Shipment Not Found</div>
        <div style={{ fontSize: 14, color: '#475569' }}>Invalid or expired tracking link.</div>
      </div>
    </div>
  );

  // ── Loading ──
  if (!shipment) return (
    <div style={{
      minHeight: '100vh', background: '#020817', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ textAlign: 'center', color: '#475569' }}>
        <div style={{ fontSize: 28, marginBottom: 12, animation: 'spin 1s linear infinite' }}>⟳</div>
        <div style={{ fontSize: 14 }}>Loading shipment…</div>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh', background: '#020817', fontFamily: 'Inter, sans-serif',
      backgroundImage: 'radial-gradient(ellipse 80% 50% at 20% 10%, rgba(59,130,246,0.06) 0%, transparent 60%)',
    }}>

      {/* ── Header ── */}
      <header style={{
        background: 'rgba(5,10,25,0.9)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 20px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>🚀</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>SupplyChain</div>
            <div style={{ fontSize: 10, color: '#475569' }}>Live Tracking</div>
          </div>
        </div>
        <button onClick={copyLink} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 8, padding: '6px 12px',
          color: copied ? '#4ade80' : '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.2s',
        }}>
          {copied ? '✓ Copied!' : '🔗 Copy Link'}
        </button>
      </header>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>

        {/* ── Status Banner ── */}
        <div style={{
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          borderRadius: 16, padding: '16px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: `${cfg.color}22`, border: `2px solid ${cfg.color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            {shipment.status === 'ongoing' ? '🚛' : shipment.status === 'completed' ? '✅' : '❌'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: cfg.color, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
              {cfg.label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>
              {shipment.from?.split(',')[0]} → {shipment.to?.split(',')[0]}
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
              Tracking ID: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{shipment.trackingToken}</span>
            </div>
          </div>
          {shipment.status === 'ongoing' && (
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', margin: '0 auto 4px', boxShadow: '0 0 8px #22c55e', animation: 'pulse 2s infinite' }} />
              <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 700 }}>LIVE</div>
            </div>
          )}
        </div>

        {/* ── Map ── */}
        {shipment.toLat && shipment.toLon && (
          <div style={{
            borderRadius: 16, overflow: 'hidden', marginBottom: 20,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <MapContainer
              center={[shipment.toLat, shipment.toLon]}
              zoom={12}
              style={{ height: 260, width: '100%' }}
              zoomControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[shipment.toLat, shipment.toLon]} icon={destIcon()}>
                <Popup>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>📍 Destination<br />{shipment.to?.split(',')[0]}</div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        )}

        {/* ── Info Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { icon: <Clock size={14} />, label: 'Started', value: fmtTime(shipment.startTime) },
            { icon: <Package size={14} />, label: 'Distance', value: shipment.distanceKm ? `${shipment.distanceKm} km` : '—' },
            { icon: <MapPin size={14} />, label: 'Est. Time', value: shipment.durationMin ? `${shipment.durationMin} min` : '—' },
            { icon: <Clock size={14} />, label: 'Duration', value: fmtDuration(shipment.startTime, shipment.endTime) },
          ].map(item => (
            <div key={item.label} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', marginBottom: 6 }}>
                {item.icon}
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* ── Timeline ── */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '18px 20px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Delivery Timeline
          </div>
          <Timeline status={shipment.status} startTime={shipment.startTime} endTime={shipment.endTime} />
        </div>

        {/* ── Route ── */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Route Details
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e66' }} />
              <div style={{ width: 2, height: 32, background: 'linear-gradient(180deg, #22c55e44, #ef444444)', margin: '3px 0' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef444466' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginBottom: 3 }}>FROM</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{shipment.from}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginBottom: 3 }}>TO</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{shipment.to}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: '#334155' }}>
          Powered by SupplyChain Guardian Platform · Auto-refreshes every 10s
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 999px; }
      `}</style>
    </div>
  );
}
