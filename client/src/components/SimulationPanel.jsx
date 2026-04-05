import { useState } from 'react';
import { simulate } from '../api';
import toast from 'react-hot-toast';

const WEATHER_OPTIONS = ['Clear', 'Cloudy', 'Rain', 'Fog', 'Storm'];

const PRESETS = [
  { label: '🚦 Traffic Spike', traffic: 0.9, weather: 'Clear' },
  { label: '⛈️ Storm Alert', traffic: 0.5, weather: 'Storm' },
  { label: '🌧️ Heavy Rain', traffic: 0.6, weather: 'Rain' },
  { label: '🌫️ Dense Fog', traffic: 0.55, weather: 'Fog' },
  { label: '✅ Clear Roads', traffic: 0.15, weather: 'Clear' },
];

export default function SimulationPanel() {
  const [traffic, setTraffic] = useState(0.3);
  const [weather, setWeather] = useState('Clear');
  const [loading, setLoading] = useState(false);

  async function apply(t, w) {
    setLoading(true);
    await simulate(t, w);
    setLoading(false);
    toast.success(`Simulation applied: ${w}, traffic ${Math.round(t * 100)}%`, { icon: '🎮' });
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>🎮 Admin Simulation</div>

      {/* Presets */}
      <div style={{ fontWeight: 600, fontSize: 11, color: '#64748b' }}>QUICK PRESETS</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {PRESETS.map(p => (
          <button
            key={p.label}
            className="btn-ghost"
            style={{ fontSize: 11 }}
            onClick={() => { setTraffic(p.traffic); setWeather(p.weather); apply(p.traffic, p.weather); }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Manual controls */}
      <div style={{ fontWeight: 600, fontSize: 11, color: '#64748b', marginTop: 4 }}>MANUAL CONTROL</div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Traffic Level</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: traffic > 0.7 ? '#ef4444' : traffic > 0.5 ? '#f59e0b' : '#22c55e' }}>
            {Math.round(traffic * 100)}%
          </span>
        </div>
        <input
          type="range" min="0" max="1" step="0.05"
          value={traffic}
          onChange={e => setTraffic(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#3b82f6' }}
        />
      </div>

      <div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Weather Condition</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {WEATHER_OPTIONS.map(w => (
            <button
              key={w}
              className={`btn-ghost ${weather === w ? 'active' : ''}`}
              style={{ fontSize: 11 }}
              onClick={() => setWeather(w)}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <button
        className="btn-primary"
        style={{ opacity: loading ? 0.6 : 1 }}
        onClick={() => apply(traffic, weather)}
        disabled={loading}
      >
        {loading ? 'Applying...' : '▶ Apply Simulation'}
      </button>

      <div style={{ fontSize: 10, color: '#475569', textAlign: 'center' }}>
        Simulation auto-resets after 60 seconds
      </div>
    </div>
  );
}
