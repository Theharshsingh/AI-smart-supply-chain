const { Order } = require('./models');

function genAWB() {
  return `AWB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}
function genOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const STATUS_LABELS = {
  pending: 'Order Created',
  accepted: 'Driver Accepted',
  picked_up: 'Package Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function calcPrice(distanceKm, weightKg, packageType) {
  const base = 50;
  const perKm = 12;
  const weightSurcharge = weightKg > 5 ? (weightKg - 5) * 8 : 0;
  const typeSurcharge = packageType === 'Fragile' ? 30 : packageType === 'Electronics' ? 50 : 0;
  return Math.round(base + distanceKm * perKm + weightSurcharge + typeSurcharge);
}

function registerOrderRoutes(app, io, authMiddleware, adminOnly, customerOnly, driverOnly) {
  async function allOrders() {
    return Order.find().sort({ createdAt: -1 }).lean();
  }

  async function pendingOrders() {
    return Order.find({ status: 'pending' }).sort({ createdAt: -1 }).lean();
  }

  // ── Customer: Create booking ──────────────────────────────────────────────
  app.post('/api/customer/orders', authMiddleware, customerOnly, async (req, res) => {
    const {
      pickupAddress, pickupLat, pickupLon,
      dropAddress, dropLat, dropLon,
      packageDesc, weightKg, packageType, notes,
      senderName, senderPhone, receiverName, receiverPhone,
      distanceKm,
    } = req.body;

    const pickup = pickupAddress || req.body.senderAddress;
    const drop   = dropAddress   || req.body.receiverAddress;
    const pLat   = pickupLat  || req.body.fromLat;
    const pLon   = pickupLon  || req.body.fromLon;
    const dLat   = dropLat    || req.body.toLat;
    const dLon   = dropLon    || req.body.toLon;

    if (!senderName || !receiverName || !pickup || !drop)
      return res.status(400).json({ error: 'Sender, receiver, pickup and drop addresses required' });

    const id = `ORD-${Date.now()}`;
    const awb = genAWB();
    const otp = genOTP();
    const dist = distanceKm || 0;
    const price = calcPrice(dist, weightKg || 1, packageType || 'Parcel');

    const order = await Order.create({
      id, awb, otp, status: 'pending',
      createdBy: req.user.id,
      customerId: req.user.id,
      senderName, senderPhone: senderPhone || '',
      senderAddress: pickup,
      fromLat: pLat || null, fromLon: pLon || null,
      receiverName, receiverPhone: receiverPhone || '',
      receiverAddress: drop,
      toLat: dLat || null, toLon: dLon || null,
      packageDesc: packageDesc || 'General goods', weightKg: weightKg || null,
      packageType: packageType || 'Parcel', notes: notes || '',
      distanceKm: dist,
      driverId: null, driverName: null,
      timeline: [{ status: 'pending', label: 'Order Created', time: new Date().toISOString(), note: 'Booked by customer' }],
      currentLat: null, currentLng: null, locationUpdatedAt: null,
      deliveredAt: null, otpVerified: false,
    });

    // Emit new order to all drivers
    io.emit('new_order_request', order);
    io.emit('pending_orders_update', await pendingOrders());

    res.json({ ok: true, order, price });
  });

  // ── Customer: List own orders ─────────────────────────────────────────────
  app.get('/api/customer/orders', authMiddleware, customerOnly, async (req, res) => {
    const orders = await Order.find({ customerId: req.user.id }).sort({ createdAt: -1 }).lean();
    res.json(Array.isArray(orders) ? orders : []);
  });

  // ── Customer: Cancel own pending order ────────────────────────────────────
  app.delete('/api/customer/orders/:id', authMiddleware, customerOnly, async (req, res) => {
    const order = await Order.findOne({ id: req.params.id, customerId: req.user.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'Can only cancel pending orders' });

    order.status = 'cancelled';
    order.timeline.push({ status: 'cancelled', label: 'Cancelled by Customer', time: new Date().toISOString(), note: 'Cancelled by customer' });
    await order.save();

    io.emit('order_status_update', order);
    io.emit('pending_orders_update', await pendingOrders());
    res.json({ ok: true, order });
  });

  // ── Customer: Submit rating/feedback ──────────────────────────────────────
  app.post('/api/customer/orders/:id/feedback', authMiddleware, customerOnly, async (req, res) => {
    const { rating, feedback } = req.body;
    const order = await Order.findOne({ id: req.params.id, customerId: req.user.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'delivered') return res.status(400).json({ error: 'Can only rate delivered orders' });

    order.rating = rating || null;
    order.feedback = feedback || '';
    await order.save();
    res.json({ ok: true });
  });

  // ── Driver: Accept order ──────────────────────────────────────────────────
  app.patch('/api/driver/orders/:id/accept', authMiddleware, driverOnly, async (req, res) => {
    const order = await Order.findOne({ id: req.params.id, status: 'pending' });
    if (!order) return res.status(404).json({ error: 'Order not found or already taken' });

    const driver = await req.dbUser || await (require('./models').User.findOne({ id: req.user.id }));
    const driverName = req.user.name;
    const driverPhone = req.user.phone || '';

    order.status = 'accepted';
    order.driverId = req.user.id;
    order.driverName = driverName;
    order.driverPhone = driverPhone;
    order.driverVehicle = '';
    order.timeline.push({ status: 'accepted', label: 'Driver Accepted', time: new Date().toISOString(), note: `${driverName} accepted this order` });
    await order.save();

    io.emit('order_accepted', { orderId: order.id, driverId: req.user.id, driverName, driverPhone });
    io.emit('order_status_update', order);
    io.emit('pending_orders_update', await pendingOrders());
    res.json({ ok: true, order });
  });

  // ── Driver: Reject order ──────────────────────────────────────────────────
  app.patch('/api/driver/orders/:id/reject', authMiddleware, driverOnly, async (req, res) => {
    const order = await Order.findOne({ id: req.params.id, status: 'pending' });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Just emit rejection so other drivers know this driver passed
    io.emit('order_rejected', { orderId: order.id, driverId: req.user.id });
    res.json({ ok: true });
  });

  // ── Driver: Mark picked up ────────────────────────────────────────────────
  app.patch('/api/driver/orders/:id/pickup', authMiddleware, driverOnly, async (req, res) => {
    const order = await Order.findOne({ id: req.params.id, driverId: req.user.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'accepted') return res.status(400).json({ error: 'Order must be accepted first' });

    order.status = 'picked_up';
    order.timeline.push({ status: 'picked_up', label: 'Package Picked Up', time: new Date().toISOString(), note: 'Package picked up by driver' });
    await order.save();

    io.emit('order_status_update', order);
    // Notify customer to share OTP with driver
    io.emit('otp_reminder', { orderId: order.id, customerId: order.customerId, otp: order.otp, driverName: order.driverName });
    res.json({ ok: true, order });
  });

  // ── Driver: Mark in_transit ───────────────────────────────────────────────
  app.patch('/api/driver/orders/:id/transit', authMiddleware, driverOnly, async (req, res) => {
    const order = await Order.findOne({ id: req.params.id, driverId: req.user.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'picked_up') return res.status(400).json({ error: 'Order must be picked up first' });

    order.status = 'in_transit';
    order.timeline.push({ status: 'in_transit', label: 'In Transit', time: new Date().toISOString(), note: 'Package in transit to destination' });
    await order.save();

    io.emit('order_status_update', order);
    res.json({ ok: true, order });
  });

  // ── Driver: Deliver with OTP verification ─────────────────────────────────
  app.patch('/api/driver/orders/:id/deliver', authMiddleware, driverOnly, async (req, res) => {
    const { otp } = req.body;
    const order = await Order.findOne({ id: req.params.id, driverId: req.user.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'in_transit' && order.status !== 'picked_up') return res.status(400).json({ error: 'Order must be in transit' });
    if (String(order.otp) !== String(otp)) return res.status(400).json({ error: 'Invalid OTP' });

    order.status = 'delivered';
    order.otpVerified = true;
    order.deliveredAt = new Date().toISOString();
    order.timeline.push({ status: 'delivered', label: 'Package Delivered', time: new Date().toISOString(), note: 'Delivered — OTP confirmed' });
    await order.save();

    io.emit('order_status_update', order);
    res.json({ ok: true, order });
  });

  // ── Driver: Update GPS location ───────────────────────────────────────────
  app.patch('/api/driver/orders/:id/location', authMiddleware, driverOnly, async (req, res) => {
    const { lat, lng } = req.body;
    const order = await Order.findOneAndUpdate(
      { id: req.params.id, driverId: req.user.id },
      { currentLat: lat, currentLng: lng, locationUpdatedAt: new Date().toISOString() },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found or not assigned to you' });

    io.emit('driver_location_update', { orderId: order.id, lat, lng, driverId: req.user.id });
    res.json({ ok: true });
  });

  // ── Driver: Get my accepted orders ────────────────────────────────────────
  app.get('/api/driver/orders', authMiddleware, driverOnly, async (req, res) => {
    const orders = await Order.find({
      driverId: req.user.id,
      status: { $in: ['accepted', 'picked_up', 'in_transit', 'delivered'] }
    }).sort({ createdAt: -1 }).lean();
    res.json(Array.isArray(orders) ? orders : []);
  });

  // ── Driver: Get pending orders list ───────────────────────────────────────
  app.get('/api/driver/orders/pending', authMiddleware, driverOnly, async (req, res) => {
    const orders = await pendingOrders();
    res.json(Array.isArray(orders) ? orders : []);
  });

  // ── Admin: Get all orders ─────────────────────────────────────────────────
  app.get('/api/admin/orders', authMiddleware, adminOnly, async (req, res) => {
    res.json(await allOrders());
  });

  // ── Admin: Assign driver to pending order ─────────────────────────────────
  app.post('/api/admin/orders/:id/assign', authMiddleware, adminOnly, async (req, res) => {
    const { driverId, driverName } = req.body;
    if (!driverId || !driverName) return res.status(400).json({ error: 'driverId and driverName required' });

    const order = await Order.findOne({ id: req.params.id, status: 'pending' });
    if (!order) return res.status(404).json({ error: 'Pending order not found' });

    order.driverId = driverId;
    order.driverName = driverName;
    order.status = 'accepted';
    order.timeline.push({ status: 'accepted', label: 'Driver Assigned by Admin', time: new Date().toISOString(), note: `Manually assigned to ${driverName}` });
    await order.save();

    io.emit('order_accepted', { orderId: order.id, driverId, driverName });
    io.emit('order_status_update', order);
    io.emit('pending_orders_update', await pendingOrders());
    res.json({ ok: true, order });
  });

  // ── Public tracking ───────────────────────────────────────────────────────
  app.get('/api/track/:awb', async (req, res) => {
    const order = await Order.findOne({ awb: req.params.awb.toUpperCase() }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const { otp, createdBy, ...safe } = order;
    res.json(safe);
  });

  // ── Socket: send pending orders on connect ────────────────────────────────
  io.on('connection', async socket => {
    socket.emit('orders_update', await allOrders());
    socket.emit('pending_orders_update', await pendingOrders());
  });
}

module.exports = { registerOrderRoutes };