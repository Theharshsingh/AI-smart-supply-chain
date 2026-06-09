const fs   = require('fs');
const path = require('path');

const ORDERS_FILE = path.join(__dirname, 'orders.json');

function loadOrders() {
  try {
    if (!fs.existsSync(ORDERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch { return []; }
}

function saveOrders(data) {
  try { fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2)); } catch {}
}

// Generate AWB number
function genAWB() {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `AWB-${ts}-${rnd}`;
}

// Generate 4-digit OTP
function genOTP() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Status flow
const STATUS_FLOW = [
  'pending',        // order created, not yet assigned
  'assigned',       // driver assigned
  'picked_up',      // driver picked up package
  'in_transit',     // on the way
  'out_for_delivery', // near destination
  'delivered',      // OTP confirmed
  'cancelled',
];

function registerOrderRoutes(app, io, authMiddleware, adminOnly) {
  let orders = loadOrders();

  function broadcast() {
    io.emit('orders_update', orders);
  }

  // ── Admin: Create order ───────────────────────────────────────────────────
  app.post('/api/orders', authMiddleware, adminOnly, (req, res) => {
    const {
      senderName, senderPhone, senderAddress,
      receiverName, receiverPhone, receiverAddress,
      fromLat, fromLon, toLat, toLon,
      packageDesc, weightKg, packageType,
      notes, distanceKm, durationMin,
    } = req.body;

    if (!senderName || !receiverName || !senderAddress || !receiverAddress) {
      return res.status(400).json({ error: 'Sender and receiver details required' });
    }

    const order = {
      id:             `ORD-${Date.now()}`,
      awb:            genAWB(),
      otp:            genOTP(),
      status:         'pending',
      createdAt:      new Date().toISOString(),
      updatedAt:      new Date().toISOString(),
      createdBy:      req.user.id,

      // Sender
      senderName, senderPhone: senderPhone || '', senderAddress,
      fromLat: fromLat || null, fromLon: fromLon || null,

      // Receiver
      receiverName, receiverPhone: receiverPhone || '', receiverAddress,
      toLat: toLat || null, toLon: toLon || null,

      // Package
      packageDesc:  packageDesc  || 'General goods',
      weightKg:     weightKg     || null,
      packageType:  packageType  || 'standard',
      notes:        notes        || '',

      // Route
      distanceKm:  distanceKm  || null,
      durationMin: durationMin || null,

      // Assignment
      driverId:   null,
      driverName: null,

      // Timeline events
      timeline: [
        { status: 'pending', label: 'Order Created', time: new Date().toISOString(), note: `Created by admin` },
      ],

      // GPS
      currentLat: null, currentLng: null, locationUpdatedAt: null,

      // Delivery proof
      deliveredAt: null, otpVerified: false,
    };

    orders = [order, ...orders];
    saveOrders(orders);
    broadcast();
    res.json({ ok: true, order });
  });

  // ── Admin: Get all orders ─────────────────────────────────────────────────
  app.get('/api/orders', authMiddleware, adminOnly, (req, res) => {
    res.json(orders);
  });

  // ── Admin: Assign driver ──────────────────────────────────────────────────
  app.patch('/api/orders/:id/assign', authMiddleware, adminOnly, (req, res) => {
    const { driverId, driverName } = req.body;
    const idx = orders.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });

    orders[idx] = {
      ...orders[idx],
      driverId, driverName,
      status: 'assigned',
      updatedAt: new Date().toISOString(),
      timeline: [
        ...orders[idx].timeline,
        { status: 'assigned', label: 'Driver Assigned', time: new Date().toISOString(), note: `Assigned to ${driverName}` },
      ],
    };
    saveOrders(orders);
    broadcast();
    res.json({ ok: true, order: orders[idx] });
  });

  // ── Admin: Cancel order ───────────────────────────────────────────────────
  app.patch('/api/orders/:id/cancel', authMiddleware, adminOnly, (req, res) => {
    const idx = orders.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });

    orders[idx] = {
      ...orders[idx],
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
      timeline: [
        ...orders[idx].timeline,
        { status: 'cancelled', label: 'Order Cancelled', time: new Date().toISOString(), note: req.body.reason || '' },
      ],
    };
    saveOrders(orders);
    broadcast();
    res.json({ ok: true });
  });

  // ── Driver: Get assigned orders ───────────────────────────────────────────
  app.get('/api/orders/mine', authMiddleware, (req, res) => {
    res.json(orders.filter(o => o.driverId === req.user.id && o.status !== 'cancelled'));
  });

  // ── Driver: Update order status ───────────────────────────────────────────
  app.patch('/api/orders/:id/status', authMiddleware, (req, res) => {
    const { status, note } = req.body;
    const idx = orders.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });

    // Driver can only update their own orders
    if (req.user.role !== 'admin' && orders[idx].driverId !== req.user.id) {
      return res.status(403).json({ error: 'Not your order' });
    }

    const LABELS = {
      picked_up:        'Package Picked Up',
      in_transit:       'In Transit',
      out_for_delivery: 'Out for Delivery',
      delivered:        'Delivered',
      cancelled:        'Cancelled',
    };

    orders[idx] = {
      ...orders[idx],
      status,
      updatedAt: new Date().toISOString(),
      deliveredAt: status === 'delivered' ? new Date().toISOString() : orders[idx].deliveredAt,
      timeline: [
        ...orders[idx].timeline,
        { status, label: LABELS[status] || status, time: new Date().toISOString(), note: note || '' },
      ],
    };
    saveOrders(orders);
    broadcast();
    res.json({ ok: true, order: orders[idx] });
  });

  // ── Driver: Update GPS location ───────────────────────────────────────────
  app.patch('/api/orders/:id/location', authMiddleware, (req, res) => {
    const { lat, lng } = req.body;
    const idx = orders.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });

    orders[idx] = {
      ...orders[idx],
      currentLat: lat, currentLng: lng,
      locationUpdatedAt: new Date().toISOString(),
    };
    saveOrders(orders);
    broadcast();
    res.json({ ok: true });
  });

  // ── Driver: Verify OTP (delivery confirmation) ────────────────────────────
  app.post('/api/orders/:id/verify-otp', authMiddleware, (req, res) => {
    const { otp } = req.body;
    const idx = orders.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });

    if (orders[idx].otp !== String(otp)) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    orders[idx] = {
      ...orders[idx],
      status: 'delivered',
      otpVerified: true,
      deliveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [
        ...orders[idx].timeline,
        { status: 'delivered', label: '✅ Delivered — OTP Verified', time: new Date().toISOString(), note: 'Customer OTP confirmed' },
      ],
    };
    saveOrders(orders);
    broadcast();
    res.json({ ok: true, order: orders[idx] });
  });

  // ── Public: Track by AWB (no auth needed) ────────────────────────────────
  app.get('/api/track/:awb', (req, res) => {
    const order = orders.find(o => o.awb === req.params.awb.toUpperCase());
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Return safe public data (no OTP)
    const { otp, createdBy, ...safe } = order;
    res.json(safe);
  });

  // On new socket connection, send current orders
  io.on('connection', socket => {
    socket.emit('orders_update', orders);
  });
}

module.exports = { registerOrderRoutes };
