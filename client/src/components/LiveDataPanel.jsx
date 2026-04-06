import { useState } from 'react';
import toast from 'react-hot-toast';
import { weatherIcon, weatherColor } from '../utils';

const API_URL = 'http://localhost:4000';

export default function LiveDataPanel({ env }) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch(`${API_URL}/api/refresh`, { method: 'POST' });
      toast.success('Data refreshed', { icon: '🔄' });
    } catch {
      toast.error('Refresh failed');
    }
    setRefreshing(false);
  }

  const { weatherData = {}, trafficData = {}, apiStatus = {}, lastUpdated, forecastWorst } = env;
  const congPct   = Math.round((trafficData.congestion || 0) * 100);
  const congColor = congPct > 70 ? 'var(--red)' : congPct > 50 ? 'var(--amber)' : 'var(--green)';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card-hdr" style={{ marginBottom: 0 }}>
        <div className="card-title">
          <div className="ct-icon">🌐</div>
          Live Data Sources
        </div>
        <button
          className="btn-ghost"
          style={{ fontSize: 11, padding: '5px 10px', opacity: refreshing ? 0.6 : 1 }}
          onClick={handleRefresh} disabled={refreshing}
        >
          {refreshing ? <><span className="spin-anim">⟳</span> Refreshing</> : '🔄 Refresh'}
        </button>
      </div>

      <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>
        Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'} · Auto-refreshes every 30s
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Weather API', status: apiStatus.weather, icon: '🌤️' },
          { label: 'Traffic API', status: apiStatus.traffic, icon: '🚦' },
        ].map(({ label, status, icon }) => {
          const isLive = status === 'live' || status === 'google';
          return (
            <div key={label} className="card2" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
              <span className={`badge ${isLive ? 'badge-green' : 'badge-yellow'}`}>
                {isLive ? 'LIVE' : 'HEURISTIC'}
              </span>
              <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 4 }}>{label}</div>
            </div>
          );
        })}
      </div>

      <div className="card2">
        <div className="sec-lbl">Current Weather</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 34 }}>{weatherIcon(weatherData.condition)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: weatherColor(weatherData.condition) }}>
              {weatherData.condition || '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--tx-3)', textTransform: 'capitalize' }}>
              {weatherData.description || '—'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--tx-1)' }}>{weatherData.temp ?? '—'}°C</div>
            <div style={{ fontSize: 10, color: 'var(--tx-3)' }}>Temperature</div>
          </div>
        </div>
        <div className="divider" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[
            { label: 'Humidity',      value: `${weatherData.humidity ?? '—'}%` },
            { label: 'Wind',          value: `${weatherData.windSpeed ?? '—'} km/h` },
            { label: 'Forecast Risk', value: forecastWorst || 'Clear', color: weatherColor(forecastWorst) },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.color || 'var(--tx-1)' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--tx-3)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {weatherData.forecast?.length > 0 && (
        <div className="card2">
          <div className="sec-lbl">3-Hour Forecast</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {weatherData.forecast.map((f, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 18 }}>{weatherIcon(f.condition)}</div>
                <div style={{ fontSize: 10, color: weatherColor(f.condition), fontWeight: 600, marginTop: 2 }}>{f.condition}</div>
                <div style={{ fontSize: 10, color: 'var(--tx-3)' }}>{f.time?.slice(11, 16) || `+${(i + 1) * 3}h`}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card2">
        <div className="sec-lbl">Live Traffic</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
          {[
            { label: 'Congestion',    value: `${congPct}%` },
            { label: 'Free-flow ETA', value: trafficData.durationMin ? `${trafficData.durationMin} min` : '—' },
            { label: 'Traffic ETA',   value: trafficData.durationTrafficMin ? `${trafficData.durationTrafficMin} min` : '—' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--tx-3)' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div className="risk-bar-track">
          <div className="risk-bar-fill" style={{ width: `${congPct}%`, background: congColor }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 6 }}>
          Source: {trafficData.source === 'google' ? '✅ Google Maps API' : '⚠️ Time-of-day heuristic'}
        </div>
      </div>

      {(apiStatus.weather !== 'live' || apiStatus.traffic !== 'google') && (
        <div className="alert-info" style={{ fontSize: 11 }}>
          💡 Add <b>OPENWEATHER_API_KEY</b> and <b>GOOGLE_MAPS_API_KEY</b> to <code>server/.env</code> for fully live data.
        </div>
      )}
    </div>
  );
}
