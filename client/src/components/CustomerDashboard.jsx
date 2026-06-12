import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { customerCreateOrder, customerGetOrders, customerCancelOrder, customerSubmitFeedback, fetchAutocomplete } from '../api';
import { useSocket } from '../api';
import {
  Package, MapPin, Phone, User, Weight, FileText, CreditCard, X, Truck,
  Circle, ChevronRight, Clock, Navigation, Copy, Star, MessageSquare,
  Send, ArrowLeft, Map as MapIcon, Loader2, CheckCircle, AlertCircle,
  ChevronDown, Search, DollarSign,
} from 'lucide-react';

function calcPrice(distanceKm, weightKg, packageType) {
  const base = 50;
  const perKm = 12;
  const weightSurcharge = weightKg > 5 ? (weightKg - 5) * 8 : 0;
  const typeSurcharge = packageType === 'Fragile' ? 30 : packageType === 'Electronics' ? 50 : 0;
  return Math.round(base + (distanceKm || 0) * perKm + weightSurcharge + typeSurcharge);
}

const STATUS_COLORS = {
  pending: '#fcd34d',
  accepted: '#60a5fa',
  picked_up: '#a78bfa',
  in_transit: '#60a5fa',
  delivered: '#4ade80',
  cancelled: '#f87171',
};

const STATUS_ICONS = {
  pending: Clock,
  accepted: CheckCircle,
  picked_up: Package,
  in_transit: Truck,
  delivered: CheckCircle,
  cancelled: AlertCircle,
};

const STATUS_LABELS = {
  pending: 'Requested',
  accepted: 'Accepted',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const TIMELINE_STEPS = ['pending', 'accepted', 'picked_up', 'in_transit', 'delivered'];

// Custom driver icon
const driverIcon = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;background:#3b82f6;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(59,130,246,0.5);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2"/><path d="M3 10h18"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const pickupIcon = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;background:#22c55e;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(34,197,94,0.5);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#22c55e" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const dropIcon = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;background:#ef4444;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(239,68,68,0.5);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" stroke="white" stroke-width="2"><path d="M12 2C7 2 4 7 4 12c0 5 4 10 8 10s8-5 8-10c0-5-3-10-8-10z"/></svg></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function FitBounds({ pickup, drop, driver }) {
  const map = useMap();
  useEffect(() => {
    const points = [];
    if (pickup) points.push([pickup[0], pickup[1]]);
    if (drop) points.push([drop[0], drop[1]]);
    if (driver) points.push([driver[0], driver[1]]);
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    }
  }, [pickup, drop, driver, map]);
  return null;
}

function AnimatedDriverMarker({ position }) {
  const markerRef = useRef(null);
  const map = useMap();

  useEffect(() => {
    if (markerRef.current && position) {
      markerRef.current.setLatLng(position);
    }
  }, [position]);

  return position ? (
    <Marker ref={markerRef} position={position} icon={driverIcon}>
      <Popup>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6' }}>Driver Location</div>
      </Popup>
    </Marker>
  ) : null;
}

// ── Haversine distance ────────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Location Autocomplete Input ─────────────────────────────────────────────
function LocationInput({ value, onChange, onSelect, placeholder, icon }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (value.length < 2) { setSuggestions([]); setOpen(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchAutocomplete(value);
      if (Array.isArray(results)) {
        setSuggestions(results);
        setOpen(results.length > 0);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  function handleSelect(s) {
    setOpen(false);
    setSuggestions([]);
    onSelect({ address: s.description, lat: s.lat, lon: s.lon });
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
          const data = await res.json();
          const address = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          onSelect({ address, lat, lon: lng });
          onChange(address);
        } catch {
          const address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          onSelect({ address, lat, lon: lng });
          onChange(address);
        }
        setGpsLoading(false);
      },
      () => { toast.error('Could not get location'); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: focused ? '1.5px solid #3b82f6' : '1.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 12px', transition: 'border-color 0.2s' }}>
        <span style={{ color: 'var(--tx-3)', display: 'flex' }}>{icon || <MapPin size={14} />}</span>
        <input
          value={value}
          onChange={e => { onChange(e.target.value); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => { setFocused(false); setOpen(false); }, 200)}
          placeholder={placeholder || 'Search location...'}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--tx-1)', fontSize: 13, fontFamily: 'inherit' }}
        />
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={gpsLoading}
          title="Use current location"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#60a5fa', display: 'flex', flexShrink: 0 }}
        >
          {gpsLoading
            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : <Navigation size={14} />}
        </button>
      </div>
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, marginTop: 4, maxHeight: 240, overflowY: 'auto', boxShadow: '0 16px 40px rgba(0,0,0,0.8)' }}>
          {suggestions.map((s, i) => (
            <div
              key={s.placeId || i}
              onMouseDown={() => handleSelect(s)}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--tx-2)', borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 600, color: 'var(--tx-1)', marginBottom: 2 }}>{s.structured?.main || s.description.split(',')[0]}</div>
              <div style={{ fontSize: 10, color: 'var(--tx-3)' }}>{s.structured?.secondary || s.description.split(',').slice(1, 3).join(',').trim()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Status Timeline Stepper ────────────────────────────────────────────────
function StatusTimeline({ timeline }) {
  const currentStatus = timeline?.[timeline.length - 1]?.status || 'pending';
  const currentIdx = TIMELINE_STEPS.indexOf(currentStatus);
  const displayStatuses = TIMELINE_STEPS.slice(0, currentIdx + 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {TIMELINE_STEPS.map((step, i) => {
        const done = currentIdx >= i;
        const isCurrent = currentIdx === i;
        const StepIcon = STATUS_ICONS[step] || Circle;
        const timelineEntry = Array.isArray(timeline) ? timeline.find(t => t.status === step) : null;

        return (
          <div key={step} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i < TIMELINE_STEPS.length - 1 ? 20 : 0 }}>
            {/* Connector line */}
            {i < TIMELINE_STEPS.length - 1 && (
              <div style={{
                position: 'absolute', left: 13, top: 28, width: 2, height: 24,
                background: done ? STATUS_COLORS[step] || '#3b82f6' : 'rgba(255,255,255,0.08)',
              }} />
            )}
            {/* Icon */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: done ? (STATUS_COLORS[step] || '#3b82f6') : 'rgba(255,255,255,0.05)',
              border: done ? 'none' : '2px solid rgba(255,255,255,0.1)',
              flexShrink: 0, transition: 'all 0.3s',
            }}>
              <StepIcon size={12} color={done ? '#fff' : 'var(--tx-3)'} />
            </div>
            {/* Label */}
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: done ? 'var(--tx-1)' : 'var(--tx-3)' }}>
                {STATUS_LABELS[step] || step}
                {isCurrent && <span style={{ marginLeft: 6, fontSize: 10, color: STATUS_COLORS[step], fontWeight: 700 }}>●</span>}
              </div>
              {timelineEntry && (
                <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 2 }}>
                  {timelineEntry.time ? new Date(timelineEntry.time).toLocaleString() : ''}
                  {timelineEntry.note && <span> — {timelineEntry.note}</span>}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tracking Modal ──────────────────────────────────────────────────────────
function TrackingModal({ order, onClose }) {
  const { driverLocation, orderStatusUpdate } = useSocket();
  const [eta, setEta] = useState(null);
  const mapRef = useRef(null);

  // Listen for status updates for this order
  useEffect(() => {
    if (orderStatusUpdate && orderStatusUpdate.id === order?.id) {
      // Parent will refresh orders
    }
  }, [orderStatusUpdate, order?.id]);

  // Calculate approximate ETA
  useEffect(() => {
    if (order?.distanceKm && order?.status !== 'delivered') {
      const avgSpeed = 30; // km/h average city speed
      const remaining = order.distanceKm * 0.5; // rough estimate
      const mins = Math.round((remaining / avgSpeed) * 60);
      setEta(Math.max(2, mins));
    }
  }, [order]);

  if (!order) return null;

  const pickupPos = order.fromLat && order.fromLon ? [order.fromLat, order.fromLon] : null;
  const dropPos = order.toLat && order.toLon ? [order.toLat, order.toLon] : null;
  const driverPos = driverLocation && driverLocation.orderId === order.id
    ? [driverLocation.lat, driverLocation.lng]
    : (order.currentLat && order.currentLng ? [order.currentLat, order.currentLng] : null);

  const statusIdx = TIMELINE_STEPS.indexOf(order.status);
  const isDelivered = order.status === 'delivered';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--tx-1)', display: 'flex' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>Live Tracking</div>
            <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{order.awb}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isDelivered && eta && (
            <div style={{ background: 'rgba(59,130,246,0.12)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} /> ~{eta} min
            </div>
          )}
          <div style={{
            background: `${STATUS_COLORS[order.status]}15`,
            borderRadius: 8, padding: '4px 10px',
            fontSize: 11, fontWeight: 700, color: STATUS_COLORS[order.status],
          }}>
            {STATUS_LABELS[order.status] || order.status}
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, minHeight: 300, position: 'relative' }}>
        <MapContainer
          center={driverPos || pickupPos || [20.5937, 78.9629]}
          zoom={12}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {pickupPos && <Marker position={pickupPos} icon={pickupIcon}><Popup>Pickup</Popup></Marker>}
          {dropPos && <Marker position={dropPos} icon={dropIcon}><Popup>Drop-off</Popup></Marker>}
          {driverPos && <AnimatedDriverMarker position={driverPos} />}
          <FitBounds pickup={pickupPos} drop={dropPos} driver={driverPos} />
        </MapContainer>

        {/* Status overlay badge */}
        {isDelivered && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 400, background: 'rgba(34,197,94,0.9)', borderRadius: 20, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={16} color="#fff" />
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>Delivered Successfully!</span>
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div style={{ background: '#0a1228', borderTop: '1px solid rgba(255,255,255,0.07)', padding: 16, maxHeight: 280, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {/* Driver Info */}
          {order.driverName && (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Driver</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={14} color="#60a5fa" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{order.driverName}</div>
                  {order.driverPhone && <div style={{ fontSize: 11, color: 'var(--tx-2)' }}>{order.driverPhone}</div>}
                </div>
              </div>
            </div>
          )}

          {/* OTP */}
          {!isDelivered && order.otp && (
            <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: 10, padding: 12, border: '1px solid rgba(245,158,11,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Delivery OTP</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fcd34d', letterSpacing: '0.1em', fontFamily: 'monospace' }}>{order.otp}</div>
              <div style={{ fontSize: 9, color: 'var(--tx-3)', marginTop: 2 }}>Share with driver at delivery</div>
            </div>
          )}

          {isDelivered && (
            <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Delivered At</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>
                {order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : 'N/A'}
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Status Timeline</div>
          <StatusTimeline timeline={order.timeline} />
        </div>
      </div>
    </motion.div>
  );
}

// ── Main CustomerDashboard ──────────────────────────────────────────────────
export default function CustomerDashboard({ initialTab = 'book' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [orderCreated, setOrderCreated] = useState(null);
  const { orderStatusUpdate, otpReminder } = useSocket();

  // Booking form state
  const [pickup, setPickup] = useState({ address: '', lat: null, lon: null });
  const [pickupText, setPickupText] = useState('');
  const [drop, setDrop] = useState({ address: '', lat: null, lon: null });
  const [dropText, setDropText] = useState('');
  const [packageDesc, setPackageDesc] = useState('');
  const [weightKg, setWeightKg] = useState(1);
  const [packageType, setPackageType] = useState('Parcel');
  const [notes, setNotes] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');

  // Feedback state
  const [feedbackOrder, setFeedbackOrder] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');

  const estimatedPrice = calcPrice(
    pickup.lat && drop.lat ? Math.round(haversineKm(pickup.lat, pickup.lon, drop.lat, drop.lon)) : 10,
    weightKg, packageType
  );

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customerGetOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // OTP reminder — driver picked up package
  useEffect(() => {
    if (!otpReminder) return;
    toast(
      `🔑 OTP for delivery: ${otpReminder.otp} — Share with ${otpReminder.driverName || 'driver'} when they arrive`,
      { duration: 10000, icon: '📦', style: { background: '#1a1a2e', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)' } }
    );
  }, [otpReminder]);

  // Listen for status updates
  useEffect(() => {
    if (orderStatusUpdate) {
      setOrders(prev => {
        const idx = prev.findIndex(o => o.id === orderStatusUpdate.id);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = orderStatusUpdate;
        return updated;
      });
      if (tracking && orderStatusUpdate.id === tracking.id) {
        setTracking(orderStatusUpdate);
      }
      // When driver picks up, remind sender to share OTP with driver
      if (orderStatusUpdate.status === 'picked_up') {
        const ord = orderStatusUpdate;
        toast(
          `📦 Driver picked up your package! Share OTP with driver at delivery: ${ord.otp || ''}`,
          { duration: 8000, icon: '🔑' }
        );
      }
      // When driver accepts, notify customer
      if (orderStatusUpdate.status === 'accepted') {
        toast.success(`Driver ${orderStatusUpdate.driverName || ''} accepted your order! On the way.`, { duration: 5000, icon: '🚛' });
      }
    }
  }, [orderStatusUpdate, tracking]);

  // Submit booking
  async function handleSubmit(e) {
    e.preventDefault();
    if (!senderName || !receiverName || !pickup.address || !drop.address) {
      toast.error('Please fill all required fields');
      return;
    }
    if (!pickup.lat || !pickup.lon) {
      toast.error('Please select pickup location from suggestions or use GPS');
      return;
    }
    if (!drop.lat || !drop.lon) {
      toast.error('Please select drop location from suggestions or use GPS');
      return;
    }
    const distanceKm = Math.round(haversineKm(pickup.lat, pickup.lon, drop.lat, drop.lon));
    setSubmitting(true);
    try {
      const data = await customerCreateOrder({
        pickupAddress: pickup.address,
        pickupLat: pickup.lat,
        pickupLon: pickup.lon,
        dropAddress: drop.address,
        dropLat: drop.lat,
        dropLon: drop.lon,
        packageDesc,
        weightKg,
        packageType,
        notes,
        senderName,
        senderPhone,
        receiverName,
        receiverPhone,
        distanceKm,
      });
      if (data.ok) {
        toast.success('Booking created! Waiting for a driver...');
        setOrderCreated(data.order);
        setPickup({ address: '', lat: null, lon: null });
        setPickupText('');
        setDrop({ address: '', lat: null, lon: null });
        setDropText('');
        setPackageDesc('');
        setWeightKg(1);
        setPackageType('Parcel');
        setNotes('');
        setSenderName('');
        setSenderPhone('');
        setReceiverName('');
        setReceiverPhone('');
        fetchOrders();
      } else {
        toast.error(data.error || 'Failed to create order');
      }
    } catch (e) {
      toast.error('Network error');
    }
    setSubmitting(false);
  }

  // Cancel order
  async function handleCancel(id) {
    try {
      const data = await customerCancelOrder(id);
      if (data.ok) {
        toast.success('Order cancelled');
        fetchOrders();
      } else {
        toast.error(data.error || 'Failed to cancel');
      }
    } catch {
      toast.error('Network error');
    }
  }

  // Submit feedback
  async function handleFeedback(e) {
    e.preventDefault();
    if (!feedbackOrder) return;
    try {
      const data = await customerSubmitFeedback(feedbackOrder.id, feedbackRating, feedbackText);
      if (data.ok) {
        toast.success('Thank you for your feedback!');
        setFeedbackOrder(null);
        fetchOrders();
      }
    } catch {
      toast.error('Failed to submit feedback');
    }
  }

  // Copy to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  }

  const tabs = [
    { id: 'book', label: 'New Booking', Icon: Package },
    { id: 'orders', label: 'My Orders', Icon: Truck },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tabs.map(t => (
          <motion.button
            key={t.id}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab(t.id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 10, border: '1px solid',
              borderColor: activeTab === t.id ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.07)',
              background: activeTab === t.id ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
              color: activeTab === t.id ? '#60a5fa' : 'var(--tx-2)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            <t.Icon size={15} /> {t.label}
          </motion.button>
        ))}
      </div>

      {/* ── BOOKING TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'book' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {orderCreated ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 12, padding: 20, textAlign: 'center' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <CheckCircle size={24} color="#4ade80" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 4 }}>Booking Confirmed!</div>
              <div style={{ fontSize: 12, color: 'var(--tx-2)', marginBottom: 16 }}>Your order has been placed and drivers will be notified.</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 240, margin: '0 auto 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px' }}>
                  <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>AWB Number</span>
                  <button onClick={() => copyToClipboard(orderCreated.awb)} style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {orderCreated.awb} <Copy size={12} />
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(245,158,11,0.08)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <span style={{ fontSize: 11, color: '#fcd34d' }}>Delivery OTP</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#fcd34d', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{orderCreated.otp}</span>
                </div>
              </div>

              <button
                onClick={() => { setOrderCreated(null); setActiveTab('orders'); }}
                style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '8px 20px', color: '#60a5fa', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                View My Orders
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'visible' }}>
                {/* Pickup */}
                <div className="card" style={{ padding: 16, overflow: 'visible' }}>
                  <div className="card-hdr" style={{ marginBottom: 12 }}>
                    <div className="card-title" style={{ fontSize: 12, color: '#22c55e' }}>
                      <MapPin size={13} color="#22c55e" /> Pickup Location
                    </div>
                  </div>
                  <LocationInput
                    value={pickupText}
                    onChange={v => { setPickupText(v); setPickup(prev => ({ ...prev, address: v })); }}
                    onSelect={s => { setPickupText(s.address); setPickup({ address: s.address, lat: s.lat, lon: s.lon }); }}
                    placeholder="Search pickup location..."
                    icon={<MapPin size={14} color="#22c55e" />}
                  />
                </div>

                {/* Drop */}
                <div className="card" style={{ padding: 16, overflow: 'visible' }}>
                  <div className="card-hdr" style={{ marginBottom: 12 }}>
                    <div className="card-title" style={{ fontSize: 12, color: '#ef4444' }}>
                      <MapPin size={13} color="#ef4444" /> Drop Location
                    </div>
                  </div>
                  <LocationInput
                    value={dropText}
                    onChange={v => { setDropText(v); setDrop(prev => ({ ...prev, address: v })); }}
                    onSelect={s => { setDropText(s.address); setDrop({ address: s.address, lat: s.lat, lon: s.lon }); }}
                    placeholder="Search drop location..."
                    icon={<MapPin size={14} color="#ef4444" />}
                  />
                </div>

                {/* Package Details */}
                <div className="card" style={{ padding: 16 }}>
                  <div className="card-hdr" style={{ marginBottom: 12 }}>
                    <div className="card-title"><Package size={13} color="#60a5fa" /> Package Details</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                      value={packageDesc}
                      onChange={e => setPackageDesc(e.target.value)}
                      placeholder="Package description"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx-1)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--tx-3)', display: 'block', marginBottom: 4 }}>Weight (kg)</label>
                        <input
                          type="number"
                          min={0.1}
                          step={0.1}
                          value={weightKg}
                          onChange={e => setWeightKg(parseFloat(e.target.value) || 0)}
                          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx-1)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--tx-3)', display: 'block', marginBottom: 4 }}>Type</label>
                        <select
                          value={packageType}
                          onChange={e => setPackageType(e.target.value)}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx-1)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                        >
                          <option value="Document">Document</option>
                          <option value="Parcel">Parcel</option>
                          <option value="Fragile">Fragile</option>
                          <option value="Electronics">Electronics</option>
                        </select>
                      </div>
                    </div>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Additional notes (optional)"
                      rows={2}
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx-1)', fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
                    />
                  </div>
                </div>

                {/* Contact Details */}
                <div className="card" style={{ padding: 16 }}>
                  <div className="card-hdr" style={{ marginBottom: 12 }}>
                    <div className="card-title"><User size={13} color="#60a5fa" /> Contact Details</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--tx-3)', display: 'block', marginBottom: 4 }}>Sender Name *</label>
                      <input
                        value={senderName}
                        onChange={e => setSenderName(e.target.value)}
                        placeholder="Your name"
                        required
                        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx-1)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--tx-3)', display: 'block', marginBottom: 4 }}>Sender Phone</label>
                      <input
                        value={senderPhone}
                        onChange={e => setSenderPhone(e.target.value)}
                        placeholder="Phone number"
                        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx-1)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--tx-3)', display: 'block', marginBottom: 4 }}>Receiver Name *</label>
                      <input
                        value={receiverName}
                        onChange={e => setReceiverName(e.target.value)}
                        placeholder="Receiver name"
                        required
                        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx-1)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--tx-3)', display: 'block', marginBottom: 4 }}>Receiver Phone</label>
                      <input
                        value={receiverPhone}
                        onChange={e => setReceiverPhone(e.target.value)}
                        placeholder="Phone number"
                        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx-1)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Price Estimate */}
                <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <DollarSign size={16} color="#fcd34d" />
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--tx-2)' }}>Estimated Price</div>
                      <div style={{ fontSize: 10, color: 'var(--tx-3)' }}>Base ₹50 + ₹12/km + surcharges</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fcd34d' }}>₹{estimatedPrice}</div>
                </div>

                {/* Submit */}
                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  style={{
                    width: '100%', padding: '14px 20px',
                    background: submitting ? 'rgba(59,130,246,0.5)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    border: 'none', borderRadius: 12,
                    color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: submitting ? 'none' : '0 4px 16px rgba(59,130,246,0.35)',
                  }}
                >
                  {submitting ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Booking...</> : <><Send size={16} /> Book Now</>}
                </motion.button>
              </div>
            </form>
          )}
        </motion.div>
      )}

      {/* ── ORDERS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--tx-3)' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13 }}>Loading orders...</div>
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--tx-3)' }}>
              <Package size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <div style={{ fontSize: 13 }}>No orders yet. Create your first booking!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orders.map(order => {
                const StatusIcon = STATUS_ICONS[order.status] || Circle;
                const isDelivered = order.status === 'delivered';
                const isPending = order.status === 'pending';
                const needsFeedback = isDelivered && !order.feedback;

                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                    style={{ padding: 16, cursor: 'pointer' }}
                    onClick={() => setTracking(order)}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', fontFamily: 'monospace' }}>{order.awb}</span>
                          <button
                            onClick={e => { e.stopPropagation(); copyToClipboard(order.awb); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', display: 'flex', padding: 2 }}
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--tx-2)' }}>
                          {order.senderAddress?.split(',')[0]} → {order.receiverAddress?.split(',')[0]}
                        </div>
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: `${STATUS_COLORS[order.status]}15`,
                        borderRadius: 8, padding: '4px 10px',
                        fontSize: 11, fontWeight: 700, color: STATUS_COLORS[order.status],
                      }}>
                        <StatusIcon size={11} /> {STATUS_LABELS[order.status] || order.status}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--tx-3)' }}>
                      <span>{order.packageType || 'General'}</span>
                      {order.weightKg && <span>• {order.weightKg} kg</span>}
                      {order.distanceKm && <span>• ~{Math.round(order.distanceKm)} km</span>}
                    </div>

                    {order.driverName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--tx-2)' }}>
                        <Truck size={11} color="#60a5fa" /> {order.driverName}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        onClick={e => { e.stopPropagation(); setTracking(order); }}
                        style={{ flex: 1, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '6px 12px', color: '#60a5fa', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                      >
                        <MapIcon size={12} /> Track
                      </button>
                      {isPending && (
                        <button
                          onClick={e => { e.stopPropagation(); handleCancel(order.id); }}
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '6px 12px', color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Cancel
                        </button>
                      )}
                      {needsFeedback && (
                        <button
                          onClick={e => { e.stopPropagation(); setFeedbackOrder(order); }}
                          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '6px 12px', color: '#fcd34d', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Rate
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Tracking Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {tracking && (
          <TrackingModal order={tracking} onClose={() => setTracking(null)} />
        )}
      </AnimatePresence>

      {/* ── Feedback Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {feedbackOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1100,
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={{ background: '#0a1228', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, maxWidth: 360, width: '100%' }}
            >
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <Star size={32} color="#fcd34d" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>Rate Your Delivery</div>
                <div style={{ fontSize: 12, color: 'var(--tx-2)', marginTop: 4 }}>{feedbackOrder.awb}</div>
              </div>

              {/* Star Rating */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                {[1,2,3,4,5].map(i => (
                  <button
                    key={i}
                    onClick={() => setFeedbackRating(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: i <= feedbackRating ? '#fcd34d' : 'rgba(255,255,255,0.15)' }}
                  >
                    <Star size={28} fill={i <= feedbackRating ? '#fcd34d' : 'transparent'} />
                  </button>
                ))}
              </div>

              <textarea
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                placeholder="Share your experience (optional)"
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', color: 'var(--tx-1)', fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical', marginBottom: 12 }}
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setFeedbackOrder(null)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px', color: 'var(--tx-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Skip
                </button>
                <button
                  onClick={handleFeedback}
                  style={{ flex: 1, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px', color: '#fcd34d', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Submit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}