const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { User } = require('./models');

const JWT_SECRET  = process.env.JWT_SECRET || 'supplychain_secret_2024_change_in_production';
const JWT_EXPIRES = '7d';

async function seedDefaultUsers() {
  const count = await User.countDocuments();
  if (count === 0) {
    await User.create({
      id:       'USR-001',
      name:     'Admin',
      email:    'admin@supplychain.com',
      password: bcrypt.hashSync('admin123', 10),
      role:     'admin',
      phone:    '',
      active:   true,
    });
    console.log('[Auth] Default admin created: admin@supplychain.com / admin123');
  }
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

function customerOnly(req, res, next) {
  if (req.user?.role !== 'customer') return res.status(403).json({ error: 'Customer access required' });
  next();
}

function driverOnly(req, res, next) {
  if (req.user?.role !== 'driver') return res.status(403).json({ error: 'Driver access required' });
  next();
}

function registerAuthRoutes(app) {
  app.post('/api/auth/register', async (req, res) => {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, password required' });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: 'Email already exists' });
    const user = await User.create({
      id: `CUS-${Date.now()}`, name, email: email.toLowerCase(), phone: phone || '',
      password: bcrypt.hashSync(password, 10), role: 'customer', active: true,
    });
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: 'customer', phone: user.phone } });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.active) return res.status(401).json({ error: 'Invalid email or password' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: generateToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone } });
  });

  app.post('/api/auth/register-driver', authMiddleware, adminOnly, async (req, res) => {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, password required' });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: 'Email already exists' });
    const driver = await User.create({
      id: `DRV-${Date.now()}`, name, email, phone: phone || '',
      password: bcrypt.hashSync(password, 10), role: 'driver', active: true,
    });
    res.json({ message: 'Driver created', driver: { id: driver.id, name, email, role: 'driver', phone } });
  });

  app.get('/api/auth/me', authMiddleware, async (req, res) => {
    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone });
  });

  app.get('/api/auth/drivers', authMiddleware, adminOnly, async (req, res) => {
    const drivers = await User.find({ role: 'driver' }, 'id name email phone active createdAt');
    res.json(drivers);
  });

  app.patch('/api/auth/drivers/:id', authMiddleware, adminOnly, async (req, res) => {
    const { name, phone, active, password } = req.body;
    const update = {};
    if (name     !== undefined) update.name   = name;
    if (phone    !== undefined) update.phone  = phone;
    if (active   !== undefined) update.active = active;
    if (password)               update.password = bcrypt.hashSync(password, 10);
    const user = await User.findOneAndUpdate({ id: req.params.id, role: 'driver' }, update, { new: true });
    if (!user) return res.status(404).json({ error: 'Driver not found' });
    res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone, active: user.active });
  });

  app.delete('/api/auth/drivers/:id', authMiddleware, adminOnly, async (req, res) => {
    const result = await User.deleteOne({ id: req.params.id, role: 'driver' });
    if (!result.deletedCount) return res.status(404).json({ error: 'Driver not found' });
    res.json({ message: 'Driver deleted' });
  });
}

module.exports = { registerAuthRoutes, authMiddleware, adminOnly, customerOnly, driverOnly, seedDefaultUsers };