import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Eye, EyeOff, AlertCircle, Loader2, LogIn, Shield, User, UserPlus, Mail, Phone } from 'lucide-react';
import { API_URL } from '../api';

function FloatingOrbs() {
  const orbs = useRef(
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
      size: 60 + Math.random() * 120,
      color: i % 3 === 0 ? '#3b82f6' : i % 3 === 1 ? '#6366f1' : '#22c55e',
      delay: Math.random() * 5,
      duration: 15 + Math.random() * 10,
    }))
  );

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {orbs.current.map((orb) => (
        <div
          key={orb.id}
          style={{
            position: 'absolute',
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${orb.color}33 0%, ${orb.color}11 40%, transparent 70%)`,
            animation: `orbFloat ${orb.duration}s ease-in-out ${orb.delay}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes orbFloat {
          0% { transform: translate(0, 0) scale(1); opacity: 0.3; }
          50% { transform: translate(30px, -20px) scale(1.2); opacity: 0.6; }
          100% { transform: translate(-20px, 30px) scale(0.9); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (!regName || !regEmail || !regPassword) {
      setError('Name, email and password required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, phone: regPhone, password: regPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      // Auto-login after registration
      localStorage.setItem('auth_token', data.token);
      await login(regEmail, regPassword);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  function quickLogin(role) {
    setMode('login');
    if (role === 'admin') {
      setEmail('admin@supplychain.com');
      setPassword('admin123');
    } else {
      setEmail('driver@supplychain.com');
      setPassword('driver123');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#020817',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <FloatingOrbs />

      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: `
          radial-gradient(ellipse 60% 40% at 30% 20%, rgba(59,130,246,0.08) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 70% 80%, rgba(99,102,241,0.06) 0%, transparent 60%)
        `,
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 2 }}
      >
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{ textAlign: 'center', marginBottom: 36 }}
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 0 40px rgba(59,130,246,0.35), 0 0 80px rgba(99,102,241,0.15)',
              animation: 'brandPulse 3s ease-in-out infinite',
            }}
          >
            <Rocket size={26} color="#fff" strokeWidth={2} />
          </motion.div>
          <motion.div style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            SupplyChain
          </motion.div>
          <motion.div style={{ fontSize: 13, color: '#475569', marginTop: 4, fontWeight: 500 }}>
            Guardian Platform
          </motion.div>
        </motion.div>

        {/* Glassmorphism Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          style={{
            background: 'rgba(10,18,40,0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: 36,
            boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.1)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent)',
          }} />

          {/* Mode Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 3 }}>
            <button
              onClick={() => { setMode('login'); setError(''); }}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
                background: mode === 'login' ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: mode === 'login' ? '#60a5fa' : 'var(--tx-3)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                transition: 'all 0.2s',
              }}
            >
              <LogIn size={13} /> Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
                background: mode === 'register' ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: mode === 'register' ? '#818cf8' : 'var(--tx-3)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                transition: 'all 0.2s',
              }}
            >
              <UserPlus size={13} /> Register
            </button>
          </div>

          {/* ── LOGIN FORM ──────────────────────────────────────────────────── */}
          {mode === 'login' && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ fontSize: 13, color: '#475569', marginBottom: 20, textAlign: 'center' }}>
                  Sign in as Admin, Driver, or Customer
                </div>
              </motion.div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                    Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 1, color: '#475569', display: 'flex' }}>
                      <Mail size={14} />
                    </span>
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com" required
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.04)',
                        border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 12,
                        padding: '12px 14px 12px 40px', color: '#f1f5f9', fontSize: 14,
                        outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 1, color: '#475569', display: 'flex' }}>
                      <Shield size={14} />
                    </span>
                    <input
                      type={showPass ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.04)',
                        border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 12,
                        padding: '12px 44px 12px 40px', color: '#f1f5f9', fontSize: 14,
                        outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0, display: 'flex' }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </motion.div>

                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <AlertCircle size={14} /> {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                  <button type="submit" disabled={loading}
                    style={{
                      width: '100%',
                      background: loading ? 'rgba(59,130,246,0.5)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: '#fff', border: 'none', borderRadius: 12, padding: '14px 20px',
                      fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', marginTop: 4,
                      boxShadow: loading ? 'none' : '0 4px 16px rgba(59,130,246,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                      transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                    {loading ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Signing in…</> : <><LogIn size={15} /> Sign In</>}
                  </button>
                </motion.div>
              </form>

              {/* Quick Login */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>
                  Quick Login
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }} onClick={() => quickLogin('admin')}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '10px 14px', color: '#60a5fa', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                    <Shield size={13} /> Admin
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }} onClick={() => quickLogin('driver')}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '10px 14px', color: '#4ade80', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                    <User size={13} /> Driver
                  </motion.button>
                </div>
                <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={11} /> Admin</span>
                    <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>admin@supplychain.com · admin123</span>
                  </div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><User size={11} /> Driver</span>
                    <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>driver@supplychain.com · driver123</span>
                  </div>
                </div>
              </motion.div>
            </>
          )}

          {/* ── REGISTER FORM ───────────────────────────────────────────────── */}
          {mode === 'register' && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ fontSize: 13, color: '#475569', marginBottom: 20, textAlign: 'center' }}>
                  Create your customer account
                </div>
              </motion.div>

              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 1, color: '#475569', display: 'flex' }}>
                      <User size={14} />
                    </span>
                    <input type="text" value={regName} onChange={e => setRegName(e.target.value)}
                      placeholder="John Doe" required
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px 12px 40px', color: '#f1f5f9', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                      onFocus={e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Email</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 1, color: '#475569', display: 'flex' }}>
                      <Mail size={14} />
                    </span>
                    <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                      placeholder="you@example.com" required
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px 12px 40px', color: '#f1f5f9', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                      onFocus={e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Phone (optional)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 1, color: '#475569', display: 'flex' }}>
                      <Phone size={14} />
                    </span>
                    <input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px 12px 40px', color: '#f1f5f9', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                      onFocus={e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 1, color: '#475569', display: 'flex' }}>
                      <Shield size={14} />
                    </span>
                    <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)}
                      placeholder="At least 6 characters" required minLength={6}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 42px 12px 40px', color: '#f1f5f9', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                      onFocus={e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                </motion.div>

                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <AlertCircle size={14} /> {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <button type="submit" disabled={loading}
                    style={{
                      width: '100%',
                      background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#fff', border: 'none', borderRadius: 12, padding: '14px 20px',
                      fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', marginTop: 4,
                      boxShadow: loading ? 'none' : '0 4px 16px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                      transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                    {loading ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Creating account…</> : <><UserPlus size={15} /> Create Account</>}
                  </button>
                </motion.div>
              </form>
            </>
          )}
        </motion.div>
      </motion.div>

      <style>{`
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes brandPulse { 0%,100%{box-shadow:0 0 40px rgba(59,130,246,0.35),0 0 80px rgba(99,102,241,0.15)} 50%{box-shadow:0 0 60px rgba(59,130,246,0.5),0 0 100px rgba(99,102,241,0.25)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  );
}