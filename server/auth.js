const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'supplychain_secret_2024_change_in_production';
const JWT_EXPIRES = '7d';

// ── Load / Save users DB ──────────────────────────────────────────────────────
function loadUsers() {
  try {
    if (!fs.existsSync(DB_FILE)) return [];
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch { return []; }
}

function saveUsers(users) {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

// ── Seed default admin if no users exist ─────────────────────────────────────
function seedDefaultUsers() {
  const users = loadUsers();
  if (users.length === 0) {
    const hashed = bcrypt.hashSync('admin123', 10);
    const defaultUsers = [
      {
        id: 'USR-001',
        name: 'Admin',
        email: 'admin@supplychain.com',
        password: hashed,
        role: 'admin',
        phone: '',
        createdAt: new Date().toISOString(),
        active: true,
      }
    ];
    saveUsers(defaultUsers);
    console.log('[Auth] Default admin created: admin@supplychain.com / admin123');
  }
}

// ── Generate JWT ──────────────────────────────────────────────────────────────
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// ── Verify JWT middleware ─────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Admin only middleware ─────────────────────────────────────────────────────
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ── Auth Routes ───────────────────────────────────────────────────────────────
function registerAuthRoutes(app) {

  // POST /api/auth/login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const users = loadUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.active) return res.status(403).json({ error: 'Account is deactivated' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    });
  });

  // POST /api/auth/register-driver  (admin only)
  app.post('/api/auth/register-driver', authMiddleware, adminOnly, (req, res) => {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, password required' });

    const users = loadUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const newDriver = {
      id: `DRV-${Date.now()}`,
      name,
      email,
      password: bcrypt.hashSync(password, 10),
      role: 'driver',
      phone: phone || '',
      createdAt: new Date().toISOString(),
      active: true,
    };

    users.push(newDriver);
    saveUsers(users);

    res.json({ message: 'Driver created', driver: { id: newDriver.id, name, email, role: 'driver', phone } });
  });

  // GET /api/auth/me  — verify token + get current user
  app.get('/api/auth/me', authMiddleware, (req, res) => {
    const users = loadUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone });
  });

  // GET /api/auth/drivers  (admin only)
  app.get('/api/auth/drivers', authMiddleware, adminOnly, (req, res) => {
    const users = loadUsers();
    const drivers = users
      .filter(u => u.role === 'driver')
      .map(u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, active: u.active, createdAt: u.createdAt }));
    res.json(drivers);
  });

  // PATCH /api/auth/drivers/:id  (admin only — toggle active, update info)
  app.patch('/api/auth/drivers/:id', authMiddleware, adminOnly, (req, res) => {
    const users = loadUsers();
    const idx = users.findIndex(u => u.id === req.params.id && u.role === 'driver');
    if (idx === -1) return res.status(404).json({ error: 'Driver not found' });

    const { name, phone, active, password } = req.body;
    if (name !== undefined) users[idx].name = name;
    if (phone !== undefined) users[idx].phone = phone;
    if (active !== undefined) users[idx].active = active;
    if (password) users[idx].password = bcrypt.hashSync(password, 10);

    saveUsers(users);
    const u = users[idx];
    res.json({ id: u.id, name: u.name, email: u.email, phone: u.phone, active: u.active });
  });

  // DELETE /api/auth/drivers/:id  (admin only)
  app.delete('/api/auth/drivers/:id', authMiddleware, adminOnly, (req, res) => {
    let users = loadUsers();
    const driver = users.find(u => u.id === req.params.id && u.role === 'driver');
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    users = users.filter(u => u.id !== req.params.id);
    saveUsers(users);
    res.json({ message: 'Driver deleted' });
  });
}

module.exports = { registerAuthRoutes, authMiddleware, adminOnly, seedDefaultUsers };
