const { Order } = require('./models');

function genAWB() {
  return `AWB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}
function genOTP() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

const STATUS_LABELS = {
  picked_up: 'Package Picked Up', in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery', delivered: 'Delivered', cancelled: 'Cancelled',
};

function registerOrderRoutes(app, io, authMiddleware, adminOnly) {
  function broadcast(orders) {
    io.emit('orders_update', orders);
  }

  async function allOrders() {
    return Order.find().sort({ createdAt: -1 }).lean();
  }

  app.post('/api/orders', authMiddleware, adminOnly, async (req, res) => {
    const {
      senderName, senderPhone, senderAddress,
      receiverName, receiverPhone, receiverAddress,
      fromLat, fromLon, toLat, toLon,
      packageDesc, weightKg, packageType,
      notes, distanceKm, durationMin,
    } = req.body;

    if (!senderName || !receiverName || !senderAddress || !receiverAddress)
      return res.status(400).json({ error: 'Sender and receiver details required' });

    const order = await Order.create({
      id: `ORD-${Date.now()}`, awb: genAWB(), otp: genOTP(), status: 'pending',
      createdBy: req.user.id,
      senderName, senderPhone: senderPhone || '', senderAddress,
      fromLat: fromLat || null, fromLon: fromLon || null,
      receiverName, receiverPhone: receiverPhone || '', receiverAddress,
      toLat: toLat || null, toLon: toLon || null,
      packageDesc: packageDesc || 'General goods', weightKg: weightKg || null,
      packageType: packageType || 'standard', notes: notes || '',
      distanceKm: distanceKm || null, durationMin: durationMin || null,
      driverId: null, driverName: null,
      timeline: [{ status: 'pending', label: 'Order Created', time: new Date().toISOString(), note: 'Created by admin' }],
      currentLat: null, currentLng: null, locationUpdatedAt: null,
      deliveredAt: null, otpVerified: false,
    });

    broadcast(await allOrders());
    res.json({ ok: true, order });
  });

  app.get('/api/orders', authMiddleware, adminOnly, async (req, res) => {
    res.json(await allOrders());
  });

  app.patch('/api/orders/:id/assign', authMiddleware, adminOnly, async (req, res) => {
    const { driverId, driverName } = req.body;
    const order = await Order.findOneAndUpdate(
      { id: req.params.id },
      {
        driverId, driverName, status: 'assigned', updatedAt: new Date(),
        $push: { timeline: { status: 'assigned', label: 'Driver Assigned', time: new Date().toISOString(), note: `Assigned to ${driverName}` } },
      },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    broadcast(await allOrders());
    res.json({ ok: true, order });
  });

  app.patch('/api/orders/:id/cancel', authMiddleware, adminOnly, async (req, res) => {
    const order = await Order.findOneAndUpdate(
      { id: req.params.id },
      {
        status: 'cancelled', updatedAt: new Date(),
        $push: { timeline: { status: 'cancelled', label: 'Order Cancelled', time: new Date().toISOString(), note: req.body.reason || '' } },
      },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    broadcast(await allOrders());
    res.json({ ok: true });
  });

  app.get('/api/orders/mine', authMiddleware, async (req, res) => {
    res.json(await Order.find({ driverId: req.user.id, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 }).lean());
  });

  app.patch('/api/orders/:id/status', authMiddleware, async (req, res) => {
    const { status, note } = req.body;
    const existing = await Order.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    if (req.user.role !== 'admin' && existing.driverId !== req.user.id)
      return res.status(403).json({ error: 'Not your order' });

    const order = await Order.findOneAndUpdate(
      { id: req.params.id },
      {
        status, updatedAt: new Date(),
        deliveredAt: status === 'delivered' ? new Date().toISOString() : existing.deliveredAt,
        $push: { timeline: { status, label: STATUS_LABELS[status] || status, time: new Date().toISOString(), note: note || '' } },
      },
      { new: true }
    );
    broadcast(await allOrders());
    res.json({ ok: true, order });
  });

  app.patch('/api/orders/:id/location', authMiddleware, async (req, res) => {
    const { lat, lng } = req.body;
    const order = await Order.findOneAndUpdate(
      { id: req.params.id },
      { currentLat: lat, currentLng: lng, locationUpdatedAt: new Date().toISOString() },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    broadcast(await allOrders());
    res.json({ ok: true });
  });

  app.post('/api/orders/:id/verify-otp', authMiddleware, async (req, res) => {
    const existing = await Order.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    if (existing.otp !== String(req.body.otp)) return res.status(400).json({ error: 'Invalid OTP' });

    const order = await Order.findOneAndUpdate(
      { id: req.params.id },
      {
        status: 'delivered', otpVerified: true,
        deliveredAt: new Date().toISOString(), updatedAt: new Date(),
        $push: { timeline: { status: 'delivered', label: '✅ Delivered — OTP Verified', time: new Date().toISOString(), note: 'Customer OTP confirmed' } },
      },
      { new: true }
    );
    broadcast(await allOrders());
    res.json({ ok: true, order });
  });

  app.get('/api/track/:awb', async (req, res) => {
    const order = await Order.findOne({ awb: req.params.awb.toUpperCase() }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const { otp, createdBy, ...safe } = order;
    res.json(safe);
  });

  io.on('connection', async socket => {
    socket.emit('orders_update', await allOrders());
  });
}

module.exports = { registerOrderRoutes };
