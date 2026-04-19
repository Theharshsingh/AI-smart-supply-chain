import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CheckCircle, Clock, MapPin, Package, XCircle } from 'lucide-react';

// ── Decode shipment from URL ──────────────────────────────────────────────────
function loadShipmentFromUrl() {
  try {
    const param = new URLSearchParams(window.location.search).get('tracking');
    if (!param) return null;
    try {
      const json = decodeURIComponent(escape(atob(param)));
      return JSON.parse(json);
    } catch {
      const all = JSON.parse(localStorage.getItem('shipment_history')) || [];
      return all.find(s => s.trackingToken === param) || null;
    }
  } catch { return null; }
}

// ── Haversine distance ────────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(m) {
  if (m == null) return null;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
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

// ── Map icons ─────────────────────────────────────────────────────────────────
function driverIcon() {
  return L.divIcon({
    html: `
      <div style="position:relative;width:40px;height:40px">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(34,197,94,0.2);border:2px solid rgba(34,197,94,0.5);animation:gpsPulse 2s infinite"></div>
        <div style="position:absolute;inset:6px;border-radius:50%;background:#22c55e;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 0 12px rgba(34,197,94,0.6)">🚛</div>
      </div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function originIcon() {
  return L.divIcon({
    html: `<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 8px rgba(34,197,94,0.6)"></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function destIcon() {
  return L.divIcon({
    html: `<div style="width:32px;height:32px;background:#ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid #fff;box-shadow:0 0 12px rgba(239,68,68,0.6)">📍</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

// ── Auto-fit map to show driver + destination ─────────────────────────────────
function MapFitter({ driverPos, destLat, destLon, fromLat, fromLon }) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    const points = [];
    if (driverPos) points.push([driverPos.lat, driverPos.lng]);
    if (destLat && destLon) points.push([destLat, destLon]);
    if (fromLat && fromLon) points.push([fromLat, fromLon]);

    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], 14, { animate: true });
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14, animate: true });
    }
    fittedRef.current = true;
  }, [driverPos?.lat, driverPos?.lng]);

  return null;
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  ongoing:   { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  label: 'In Transit' },
  completed: { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', label: 'Delivered' },
  cancelled: { color: '#f87171', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  label: 'Cancelled' },
};

// ── Timeline ──────────────────────────────────────────────────────────────────
function Timeline({ status, startTime, endTime }) {
  const steps = [
    { label: 'Order Placed',  icon: '📦', done: true,                                        time: startTime },
    { label: 'Picked Up',     icon: '🚛', done: true,                                        time: startTime },
    { label: 'In Transit',    icon: '🛣️', done: status !== 'cancelled',                      time: status !== 'cancelled' ? startTime : null },
    { label: status === 'cancelled' ? 'Cancelled' : 'Delivered',
                               icon: status === 'cancelled' ? '❌' : '✅',
                               done: status === 'completed' || status === 'cancelled',        time: endTime },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: step.done ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
              border: `2px solid ${step.done ? '#22c55e' : 'rgba(255,255,255,0.1)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, boxShadow: step.done ? '0 0 12px rgba(34,197,94,0.2)' : 'none',
            }}>{step.icon}</div>
            {i < steps.length - 1 && (
              <div style={{
                width: 2, height: 28,
                background: step.done ? 'linear-gradient(180deg,#22c55e,rgba(34,197,94,0.3))' : 'rgba(255,255,255,0.06)',
                margin: '3px 0',
              }} />
            )}
          </div>
          <div style={{ paddingTop: 6 }}>
            <div style={{ fontSize: 13, fontWeight: step.done ? 700 : 500, color: step.done ? '#f1f5f9' : '#475569' }}>
              {step.label}
            </div>
            {step.time && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{fmtTime(step.time)}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main TrackingPage ─────────────────────────────────────────────────────────
export default function TrackingPage() {
  const [shipment, setShipment] = useState(null);
  const [notFound, setNotFound]   = useState(false);
  const [copied, setCopied]       = useState(false);
  const [driverPos, setDriverPos] = useState(null);  // { lat, lng, accuracy }
  const [distToDestM, setDistToDestM] = useState(null);

  // Load shipment from URL
  useEffect(() => {
    const s = loadShipmentFromUrl();
    if (!s) { setNotFound(true); return; }
    setShipment(s);
  }, []);

  // Live GPS tracking — watch driver position
  useEffect(() => {
    if (!shipment || shipment.status !== 'ongoing') return;
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDriverPos({ lat, lng, accuracy: Math.round(pos.coords.accuracy) });

        if (shipment.toLat && shipment.toLon) {
          const d = haversine(lat, lng, shipment.toLat, shipment.toLon);
          setDistToDestM(Math.round(d));
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [shipment?.id]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Not found ──
  if (notFound) return (
    <div style={{ minHeight: '100vh', background: '#020817', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#f1f5f9' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>📦</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Shipment Not Found</div>
        <div style={{ fontSize: 14, color: '#475569' }}>Invalid or expired tracking link.</div>
      </div>
    </div>
  );

  if (!shipment) return (
    <div style={{ minHeight: '100vh', background: '#020817', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#475569' }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⟳</div>
        <div style={{ fontSize: 14 }}>Loading shipment…</div>
      </div>
    </div>
  );

  const cfg = STATUS_CONFIG[shipment.status] || STATUS_CONFIG.cancelled;
  const isOngoing = shipment.status === 'ongoing';

  // Map center: driver > destination > fallback India
  const mapCenter = driverPos
    ? [driverPos.lat, driverPos.lng]
    : shipment.toLat ? [shipment.toLat, shipment.toLon]
    : [20.5937, 78.9629];

  // Route line: origin → driver (if available) → destination
  const routePoints = [];
  if (shipment.fromLat && shipment.fromLon) routePoints.push([shipment.fromLat, shipment.fromLon]);
  if (driverPos) routePoints.push([driverPos.lat, driverPos.lng]);
  if (shipment.toLat && shipment.toLon) routePoints.push([shipment.toLat, shipment.toLon]);

  return (
    <div style={{ minHeight: '100vh', background: '#020817', fontFamily: 'Inter, sans-serif', backgroundImage: 'radial-gradient(ellipse 80% 50% at 20% 10%, rgba(59,130,246,0.06) 0%, transparent 60%)' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'rgba(5,10,25,0.9)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 20px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🚀</div>
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
          color: copied ? '#4ade80' : '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
        }}>
          {copied ? '✓ Copied!' : '🔗 Copy Link'}
        </button>
      </header>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>

        {/* ── Status Banner ── */}
        <div style={{
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          borderRadius: 16, padding: '16px 20px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: `${cfg.color}22`, border: `2px solid ${cfg.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            {isOngoing ? '🚛' : shipment.status === 'completed' ? '✅' : '❌'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: cfg.color, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>{cfg.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>
              {shipment.from?.split(',')[0]} → {shipment.to?.split(',')[0]}
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
              ID: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{shipment.trackingToken}</span>
            </div>
          </div>
          {isOngoing && (
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', margin: '0 auto 4px', boxShadow: '0 0 8px #22c55e', animation: 'pulse 2s infinite' }} />
              <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 700 }}>LIVE</div>
            </div>
          )}
        </div>

        {/* ── Distance to destination (live) ── */}
        {isOngoing && (
          <div style={{
            background: distToDestM != null && distToDestM <= 500 ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.08)',
            border: `1px solid ${distToDestM != null && distToDestM <= 500 ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.2)'}`,
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>{driverPos ? '📡' : '🔍'}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>
                {driverPos
                  ? distToDestM != null
                    ? distToDestM <= 500
                      ? '🎉 Driver is almost there!'
                      : `Driver is ${fmtDist(distToDestM)} away from destination`
                    : 'Driver location acquired'
                  : 'Acquiring driver location…'
                }
              </div>
              {driverPos && (
                <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                  GPS accuracy: ±{driverPos.accuracy}m · Updates live
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Live Map ── */}
        <div style={{
          borderRadius: 16, overflow: 'hidden', marginBottom: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          position: 'relative',
        }}>
          {/* Map legend */}
          <div style={{
            position: 'absolute', top: 10, left: 10, zIndex: 1000,
            background: 'rgba(5,10,25,0.88)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: '8px 12px',
            display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            {driverPos && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#f1f5f9' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                Driver (Live)
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#f1f5f9' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
              Destination
            </div>
          </div>

          <MapContainer center={mapCenter} zoom={12} style={{ height: 300, width: '100%' }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapFitter driverPos={driverPos} destLat={shipment.toLat} destLon={shipment.toLon} fromLat={shipment.fromLat} fromLon={shipment.fromLon} />

            {/* Origin marker */}
            {shipment.fromLat && shipment.fromLon && (
              <Marker position={[shipment.fromLat, shipment.fromLon]} icon={originIcon()}>
                <Popup><div style={{ fontWeight: 700, fontSize: 12 }}>🟢 Origin<br />{shipment.from?.split(',')[0]}</div></Popup>
              </Marker>
            )}

            {/* Destination marker */}
            {shipment.toLat && shipment.toLon && (
              <Marker position={[shipment.toLat, shipment.toLon]} icon={destIcon()}>
                <Popup><div style={{ fontWeight: 700, fontSize: 12 }}>📍 Destination<br />{shipment.to?.split(',')[0]}</div></Popup>
              </Marker>
            )}

            {/* Driver live marker */}
            {driverPos && (
              <Marker position={[driverPos.lat, driverPos.lng]} icon={driverIcon()} zIndexOffset={1000}>
                <Popup>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>
                    🚛 Driver Location<br />
                    <span style={{ fontWeight: 400, fontSize: 11, color: '#555' }}>
                      Accuracy: ±{driverPos.accuracy}m
                      {distToDestM != null && <><br />{fmtDist(distToDestM)} to destination</>}
                    </span>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Route line */}
            {routePoints.length >= 2 && (
              <Polyline
                positions={routePoints}
                pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.7, dashArray: driverPos ? null : '8 4' }}
              />
            )}
          </MapContainer>
        </div>

        {/* ── Info Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { icon: <Clock size={14} />,   label: 'Started',   value: fmtTime(shipment.startTime) },
            { icon: <Package size={14} />, label: 'Distance',  value: shipment.distanceKm ? `${shipment.distanceKm} km` : '—' },
            { icon: <MapPin size={14} />,  label: 'Est. Time', value: shipment.durationMin ? `${shipment.durationMin} min` : '—' },
            { icon: <Clock size={14} />,   label: 'Duration',  value: fmtDuration(shipment.startTime, shipment.endTime) },
          ].map(item => (
            <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', marginBottom: 6 }}>
                {item.icon}
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* ── Timeline ── */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Delivery Timeline</div>
          <Timeline status={shipment.status} startTime={shipment.startTime} endTime={shipment.endTime} />
        </div>

        {/* ── Route ── */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Route</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e66' }} />
              <div style={{ width: 2, height: 32, background: 'linear-gradient(180deg,#22c55e44,#ef444444)', margin: '3px 0' }} />
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

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#334155' }}>
          Powered by SupplyChain Guardian · GPS updates live
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes gpsPulse { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2.2);opacity:0} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 999px; }
      `}</style>
    </div>
  );
}
