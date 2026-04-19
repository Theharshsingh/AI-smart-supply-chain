import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2, Check, X, UserCheck, UserX } from 'lucide-react';

function useDrivers(token) {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchDrivers() {
    try {
      const res = await fetch(`${API_URL}/api/auth/drivers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDrivers(data);
    } catch { toast.error('Failed to load drivers'); }
    setLoading(false);
  }

  useEffect(() => { fetchDrivers(); }, []);
  return { drivers, loading, refetch: fetchDrivers };
}

// ── Add Driver Modal ──────────────────────────────────────────────────────────
function AddDriverModal({ token, onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Driver ${form.name} added!`, { icon: '🚛' });
      onAdded();
      onClose();
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 10,
    padding: '10px 14px', color: '#f1f5f9', fontSize: 13,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>🚛 Add New Driver</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { key: 'name',     label: 'Full Name',    type: 'text',     placeholder: 'Rahul Kumar' },
            { key: 'email',    label: 'Email',        type: 'email',    placeholder: 'driver@example.com' },
            { key: 'password', label: 'Password',     type: 'password', placeholder: 'Min 6 characters' },
            { key: 'phone',    label: 'Phone (opt.)', type: 'tel',      placeholder: '+91 98765 43210' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>{f.label}</label>
              <input
                type={f.type}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                required={f.key !== 'phone'}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>
          ))}

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171' }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff',
            border: 'none', borderRadius: 10, padding: '12px 20px',
            fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
          }}>
            {loading ? '⟳ Creating…' : '+ Create Driver Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Driver Card ───────────────────────────────────────────────────────────────
function DriverCard({ driver, token, onRefetch }) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggleActive() {
    setToggling(true);
    try {
      await fetch(`${API_URL}/api/auth/drivers/${driver.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !driver.active }),
      });
      toast.success(driver.active ? 'Driver deactivated' : 'Driver activated');
      onRefetch();
    } catch { toast.error('Failed to update driver'); }
    setToggling(false);
  }

  async function deleteDriver() {
    if (!confirm(`Delete driver ${driver.name}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetch(`${API_URL}/api/auth/drivers/${driver.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Driver deleted');
      onRefetch();
    } catch { toast.error('Failed to delete driver'); }
    setDeleting(false);
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
      opacity: driver.active ? 1 : 0.6,
      transition: 'all 0.2s',
    }}>
      {/* Avatar */}
      <div style={{
        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
        background: driver.active ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)',
        border: `2px solid ${driver.active ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.2)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>
        🚛
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{driver.name}</div>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
            background: driver.active ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
            color: driver.active ? '#4ade80' : '#64748b',
            border: `1px solid ${driver.active ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.2)'}`,
          }}>
            {driver.active ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#475569' }}>{driver.email}</div>
        {driver.phone && <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{driver.phone}</div>}
        <div style={{ fontSize: 10, color: '#334155', marginTop: 3 }}>
          Added {new Date(driver.createdAt).toLocaleDateString('en-IN')}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={toggleActive}
          disabled={toggling}
          title={driver.active ? 'Deactivate' : 'Activate'}
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: driver.active ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
            border: `1px solid ${driver.active ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
            color: driver.active ? '#f87171' : '#4ade80',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {driver.active ? <UserX size={15} /> : <UserCheck size={15} />}
        </button>
        <button
          onClick={deleteDriver}
          disabled={deleting}
          title="Delete driver"
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DriversPage() {
  const { token } = useAuth();
  const { drivers, loading, refetch } = useDrivers(token);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {showAdd && <AddDriverModal token={token} onClose={() => setShowAdd(false)} onAdded={refetch} />}

      {/* Header */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--tx-1)' }}>🚛 Driver Management</div>
          <div style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 3 }}>
            {drivers.length} driver{drivers.length !== 1 ? 's' : ''} · {drivers.filter(d => d.active).length} active
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
            border: 'none', borderRadius: 10, padding: '9px 16px',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
          }}
        >
          <Plus size={15} /> Add Driver
        </button>
      </div>

      {/* Driver list */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--tx-3)' }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>⟳</div>Loading drivers…
        </div>
      ) : drivers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tx-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚛</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No drivers yet</div>
          <div style={{ fontSize: 12 }}>Add your first driver to get started</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {drivers.map(d => (
            <DriverCard key={d.id} driver={d} token={token} onRefetch={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
