import { useState, useRef, useCallback } from 'react';
import { createOrder, fetchAutocomplete } from '../api';
import toast from 'react-hot-toast';
import { Package, User, MapPin, Weight, FileText, ChevronRight } from 'lucide-react';

// ── Location autocomplete input ───────────────────────────────────────────────
function LocationInput({ label, value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  const handleChange = useCallback(async (e) => {
    const v = e.target.value;
    onChange({ text: v, lat: null, lon: null });
    clearTimeout(timer.current);
    if (v.length < 2) { setSuggestions([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const s = await fetchAutocomplete(v);
      setSuggestions(s);
      setOpen(s.length > 0);
    }, 300);
  }, [onChange]);

  const handleSelect = useCallback((s) => {
    onChange({ text: s.description, lat: s.lat, lon: s.lon });
    setOpen(false);
    setSuggestions([]);
  }, [onChange]);

  const inp = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: `1.5px solid ${value.lat ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 10, padding: '10px 14px',
    color: 'var(--tx-1)', fontSize: 13, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.2s',
  };

  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>
        {label} {value.lat && <span style={{ color: '#4ade80' }}>✓</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          value={value.text}
          onChange={handleChange}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          style={inp}
          onFocus2={e => e.target.style.borderColor = '#3b82f6'}
        />
        {open && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
            background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
          }}>
            {suggestions.map((s, i) => (
              <div
                key={i}
                onMouseDown={() => handleSelect(s)}
                style={{
                  padding: '9px 14px', cursor: 'pointer', fontSize: 12,
                  borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ color: 'var(--tx-1)', fontWeight: 600 }}>{s.structured?.main || s.description}</div>
                {s.structured?.secondary && <div style={{ color: 'var(--tx-3)', fontSize: 11, marginTop: 2 }}>{s.structured.secondary}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Text input ────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text', required = false }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)',
          border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 10,
          padding: '10px 14px', color: 'var(--tx-1)', fontSize: 13,
          outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = '#3b82f6'}
        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
      />
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function Section({ icon: Icon, title, color, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: color + '22', border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

// ── Main CreateOrderForm ──────────────────────────────────────────────────────
export default function CreateOrderForm({ onCreated, onCancel }) {
  const [loading, setLoading] = useState(false);

  const [senderName,    setSenderName]    = useState('');
  const [senderPhone,   setSenderPhone]   = useState('');
  const [senderAddr,    setSenderAddr]    = useState({ text: '', lat: null, lon: null });

  const [receiverName,  setReceiverName]  = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverAddr,  setReceiverAddr]  = useState({ text: '', lat: null, lon: null });

  const [packageDesc,   setPackageDesc]   = useState('');
  const [weightKg,      setWeightKg]      = useState('');
  const [packageType,   setPackageType]   = useState('standard');
  const [notes,         setNotes]         = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!senderName || !receiverName || !senderAddr.text || !receiverAddr.text) {
      toast.error('Fill all required fields'); return;
    }
    setLoading(true);
    try {
      const res = await createOrder({
        senderName, senderPhone, senderAddress: senderAddr.text,
        fromLat: senderAddr.lat, fromLon: senderAddr.lon,
        receiverName, receiverPhone, receiverAddress: receiverAddr.text,
        toLat: receiverAddr.lat, toLon: receiverAddr.lon,
        packageDesc, weightKg: weightKg ? parseFloat(weightKg) : null,
        packageType, notes,
      });
      if (res.error) { toast.error(res.error); setLoading(false); return; }
      toast.success(`Order ${res.order.awb} created!`, { icon: '📦', duration: 4000 });
      onCreated?.(res.order);
    } catch { toast.error('Failed to create order'); }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Sender */}
      <Section icon={User} title="Sender Details" color="#3b82f6">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Name" value={senderName} onChange={setSenderName} placeholder="Rahul Kumar" required />
          <Field label="Phone" value={senderPhone} onChange={setSenderPhone} placeholder="+91 98765 43210" type="tel" />
        </div>
        <LocationInput label="Pickup Address" value={senderAddr} onChange={setSenderAddr} placeholder="Search pickup location…" />
      </Section>

      {/* Arrow */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 999, padding: '4px 12px' }}>
          <ChevronRight size={12} color="#60a5fa" />
          <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>DELIVER TO</span>
        </div>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* Receiver */}
      <Section icon={MapPin} title="Receiver Details" color="#22c55e">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Name" value={receiverName} onChange={setReceiverName} placeholder="Priya Sharma" required />
          <Field label="Phone" value={receiverPhone} onChange={setReceiverPhone} placeholder="+91 87654 32109" type="tel" />
        </div>
        <LocationInput label="Delivery Address" value={receiverAddr} onChange={setReceiverAddr} placeholder="Search delivery location…" />
      </Section>

      {/* Package */}
      <Section icon={Package} title="Package Details" color="#a78bfa">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Description" value={packageDesc} onChange={setPackageDesc} placeholder="Electronics, Clothes…" />
          <Field label="Weight (kg)" value={weightKg} onChange={setWeightKg} placeholder="2.5" type="number" />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Package Type</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { key: 'standard', label: '📦 Standard' },
              { key: 'fragile',  label: '🔮 Fragile' },
              { key: 'document', label: '📄 Document' },
              { key: 'perishable', label: '🧊 Perishable' },
            ].map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setPackageType(t.key)}
                style={{
                  background: packageType === t.key ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${packageType === t.key ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                  color: packageType === t.key ? '#a78bfa' : 'var(--tx-3)', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >{t.label}</button>
            ))}
          </div>
        </div>
      </Section>

      {/* Notes */}
      <Section icon={FileText} title="Special Instructions" color="#f59e0b">
        <div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Handle with care, call before delivery, leave at door…"
            rows={2}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 10,
              padding: '10px 14px', color: 'var(--tx-1)', fontSize: 13,
              outline: 'none', fontFamily: 'inherit', resize: 'vertical',
              boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.borderColor = '#3b82f6'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>
      </Section>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        {onCancel && (
          <button type="button" onClick={onCancel} style={{
            flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: '12px', color: 'var(--tx-2)', fontSize: 13,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancel</button>
        )}
        <button type="submit" disabled={loading} style={{
          flex: 2, background: loading ? 'rgba(59,130,246,0.5)' : 'linear-gradient(135deg,#3b82f6,#2563eb)',
          border: 'none', borderRadius: 10, padding: '12px',
          color: '#fff', fontSize: 13, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          boxShadow: loading ? 'none' : '0 4px 16px rgba(59,130,246,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {loading ? '⟳ Creating…' : '📦 Create Order'}
        </button>
      </div>
    </form>
  );
}
