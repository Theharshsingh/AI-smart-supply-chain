import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Package, MapPin, Phone, User, Clock, Truck, CheckCircle, XCircle, Loader2,
  Navigation, Circle, AlertCircle, ArrowUp, DollarSign, Copy, Key, Send,
  Map as MapIcon,
} from 'lucide-react';
import {
  driverAcceptOrder, driverRejectOrder, driverPickupOrder, driverTransitOrder,
  driverDeliverOrder, driverUpdateOrderLocation, driverGetOrders, driverGetPendingOrders,
} from '../api';
import { useSocket } from '../api';

const STATUS_COLORS = {
  pending: '#fcd34d',
  accepted: '#60a5fa',
  picked_up: '#a78bfa',
  in_transit: '#60a5fa',
  delivered: '#4ade80',
  cancelled: '#f87171',
};

const STATUS_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DriverOrdersPanel() {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingOrders, setPendingOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [otpModal, setOtpModal] = useState(null);
  const [otpValue, setOtpValue] = useState('');
  const gpsIntervalRef = useRef(null);
  const { newOrderRequest, orderRejected } = useSocket();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, mine] = await Promise.all([
        driverGetPendingOrders(),
        driverGetOrders(),
      ]);
      setPendingOrders(Array.isArray(pending) ? pending : []);
      setMyOrders(Array.isArray(mine) ? mine : []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Listen for new order request
  useEffect(() => {
    if (newOrderRequest) {
      setPendingOrders(prev => {
        if (prev.find(o => o.id === newOrderRequest.id)) return prev;
        return [newOrderRequest, ...prev];
      });
      setActiveTab('pending');
      toast('🚨 New delivery request!', { icon: '📦', duration: 5000 });
    }
  }, [newOrderRequest]);

  // Refresh on new connection or after rejections
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // GPS auto-update for active (non-delivered) orders
  useEffect(() => {
    const activeOrders = myOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
    if (activeOrders.length === 0) {
      if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
      return;
    }

    async function updateGPS() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { latitude: lat, longitude: lng } = pos.coords;
          for (const order of activeOrders) {
            try {
              await driverUpdateOrderLocation(order.id, lat, lng);
            } catch {}
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    }

    updateGPS();
    gpsIntervalRef.current = setInterval(updateGPS, 15000);
    return () => {
      if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
    };
  }, [myOrders]);

  // Accept order
  async function handleAccept(id) {
    try {
      const data = await driverAcceptOrder(id);
      if (data.ok) {
        toast.success('Order accepted!');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to accept');
      }
    } catch {
      toast.error('Network error');
    }
  }

  // Reject order
  async function handleReject(id) {
    try {
      await driverRejectOrder(id);
      setPendingOrders(prev => prev.filter(o => o.id !== id));
      toast('Order rejected', { icon: '👋' });
    } catch {}
  }

  // Pickup
  async function handlePickup(id) {
    try {
      const data = await driverPickupOrder(id);
      if (data.ok) {
        toast.success('Marked as picked up!');
        fetchData();
      }
    } catch {}
  }

  // Transit
  async function handleTransit(id) {
    try {
      const data = await driverTransitOrder(id);
      if (data.ok) {
        toast.success('In transit!');
        fetchData();
      }
    } catch {}
  }

  // Deliver with OTP
  async function handleDeliver(id) {
    if (!otpValue) {
      toast.error('Enter OTP');
      return;
    }
    try {
      const data = await driverDeliverOrder(id, otpValue);
      if (data.ok) {
        toast.success('Delivery confirmed!');
        setOtpModal(null);
        setOtpValue('');
        fetchData();
      } else {
        toast.error(data.error || 'Invalid OTP');
      }
    } catch {}
  }

  const tabs = [
    { id: 'pending', label: 'Pending Requests', Icon: Clock },
    { id: 'active', label: 'My Orders', Icon: Truck },
  ];

  return (
    <div>
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
            }}
          >
            <t.Icon size={15} /> {t.label}
            {t.id === 'pending' && pendingOrders.length > 0 && (
              <span style={{ background: '#fcd34d', color: '#000', borderRadius: 999, fontSize: 9, fontWeight: 800, padding: '1px 6px', lineHeight: 1.6 }}>
                {pendingOrders.length}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      {/* ── PENDING ORDERS ──────────────────────────────────────────────────── */}
      {activeTab === 'pending' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--tx-3)' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <div>Loading...</div>
            </div>
          ) : pendingOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--tx-3)' }}>
              <Clock size={32} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13 }}>No pending orders. Waiting for new requests...</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingOrders.map(order => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="card"
                  style={{ padding: 16, borderLeft: '3px solid #fcd34d' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)', fontFamily: 'monospace' }}>
                      {order.awb || order.id}
                    </div>
                    <span style={{ fontSize: 10, color: '#fcd34d', background: 'rgba(252,211,77,0.1)', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>NEW</span>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--tx-2)', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <MapPin size={11} color="#22c55e" /> From: {order.senderAddress?.split(',')[0] || 'N/A'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} color="#ef4444" /> To: {order.receiverAddress?.split(',')[0] || 'N/A'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, fontSize: 10, color: 'var(--tx-3)', marginBottom: 8 }}>
                    <span>{order.packageType || 'General'}</span>
                    {order.weightKg && <span>• {order.weightKg}kg</span>}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAccept(order.id)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '8px 12px', color: '#4ade80', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      <CheckCircle size={13} /> Accept
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleReject(order.id)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px', color: '#f87171', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      <XCircle size={13} /> Reject
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── MY ACTIVE ORDERS ──────────────────────────────────────────────────── */}
      {activeTab === 'active' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--tx-3)' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <div>Loading...</div>
            </div>
          ) : myOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--tx-3)' }}>
              <Truck size={32} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13 }}>No active orders. Accept a request to get started!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myOrders.map(order => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card"
                  style={{ padding: 16, borderLeft: `3px solid ${STATUS_COLORS[order.status] || '#60a5fa'}` }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)', fontFamily: 'monospace' }}>{order.awb || order.id}</div>
                    <div style={{
                      background: `${STATUS_COLORS[order.status]}15`,
                      borderRadius: 6, padding: '2px 8px',
                      fontSize: 10, fontWeight: 700, color: STATUS_COLORS[order.status],
                    }}>
                      {STATUS_LABELS[order.status] || order.status}
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--tx-2)', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <MapPin size={11} color="#22c55e" /> {order.senderAddress?.split(',')[0] || 'N/A'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} color="#ef4444" /> {order.receiverAddress?.split(',')[0] || 'N/A'}
                    </div>
                  </div>

                  {/* Package info */}
                  <div style={{ display: 'flex', gap: 6, fontSize: 10, color: 'var(--tx-3)', marginBottom: 8 }}>
                    <span>{order.packageType || 'General'}</span>
                    {order.weightKg && <span>• {order.weightKg}kg</span>}
                    {order.receiverName && <span>• To: {order.receiverName}</span>}
                  </div>

                  {/* OTP hint for driver - just shows it's required, not the actual OTP */}
                  {order.status === 'in_transit' && (
                    <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: 6, padding: '4px 10px', marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Key size={10} color="#fcd34d" />
                      <span style={{ fontSize: 10, color: '#fcd34d', fontWeight: 700 }}>Ask customer for OTP to deliver</span>
                    </div>
                  )}

                  {/* Action buttons based on status */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {order.status === 'accepted' && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handlePickup(order.id)}
                        style={{ flex: 1, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 8, padding: '8px 12px', color: '#a78bfa', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                      >
                        <Package size={13} /> Picked Up
                      </motion.button>
                    )}
                    {order.status === 'picked_up' && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleTransit(order.id)}
                        style={{ flex: 1, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, padding: '8px 12px', color: '#60a5fa', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                      >
                        <Navigation size={13} /> Start Transit
                      </motion.button>
                    )}
                    {order.status === 'in_transit' && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setOtpModal(order); setOtpValue(''); }}
                        style={{ flex: 1, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '8px 12px', color: '#4ade80', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                      >
                        <CheckCircle size={13} /> Deliver (OTP)
                      </motion.button>
                    )}
                    {order.status === 'delivered' && (
                      <div style={{ flex: 1, textAlign: 'center', padding: '6px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: 8, color: '#4ade80', fontSize: 11, fontWeight: 700 }}>
                        ✓ Delivered
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── OTP MODAL ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {otpModal && (
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
              style={{ background: '#0a1228', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, maxWidth: 320, width: '100%', textAlign: 'center' }}
            >
              <Key size={36} color="#fcd34d" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 4 }}>Confirm Delivery</div>
              <div style={{ fontSize: 12, color: 'var(--tx-2)', marginBottom: 16 }}>Enter the 6-digit OTP shared by the customer</div>

              <input
                value={otpValue}
                onChange={e => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter OTP"
                maxLength={6}
                style={{
                  width: '100%', boxSizing: 'border-box', textAlign: 'center',
                  background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, padding: '12px 16px',
                  color: 'var(--tx-1)', fontSize: 24, fontWeight: 800,
                  fontFamily: 'monospace', letterSpacing: '0.15em',
                  outline: 'none', marginBottom: 16,
                }}
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setOtpModal(null)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', color: 'var(--tx-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeliver(otpModal.id)}
                  style={{ flex: 1, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '10px 14px', color: '#4ade80', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >
                  <Send size={14} /> Confirm Delivery
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}