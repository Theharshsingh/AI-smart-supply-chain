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
      toast.success('Real-time data refreshed', { icon: '🔄' });
    } catch {
      toast.error('Refresh failed');
    }
    setRefreshing(false);
  }

  const { weatherData = {}, trafficData = {}, apiStatus = {}, lastUpdated, forecastWorst } = env;
  const lastUpdatedStr = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>🌐 Live Data Sources</div>
        <button className="btn-primary" style={{ fontSize: 11, padding: '5px 12px', opacity: refreshing ? 0.6 : 1 }}
          onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Now'}
        </button>
      </div>

      <div style={{ fontSize: 10, color: '#475569' }}>Last updated: {lastUpdatedStr} · Auto-refreshes every 30s</div>

      {/* API Status */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { label: 'Weather API', status: apiStatus.weather, icon: '🌤️' },
          { label: 'Traffic API', status: apiStatus.traffic, icon: '🚦' },
        ].map(({ label, status, icon }) => {
          const isLive = status === 'live' || status === 'google';
          const color = isLive ? '#22c55e' : '#f59e0b';
          const statusLabel = isLive ? 'LIVE' : status === 'heuristic' || status === 'heuristic_fallback' ? 'HEURISTIC' : 'FALLBACK';
          return (
            <div key={label} className="card2" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 20 }}>{icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color, marginTop: 4 }}>{statusLabel}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{label}</div>
            </div>
          );
        })}
      </div>

      {/* Current Weather Detail */}
      <div className="card2">
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: '#94a3b8' }}>CURRENT WEATHER</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 36 }}>{weatherIcon(weatherData.condition)}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: weatherColor(weatherData.condition) }}>
              {weatherData.condition}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>
              {weatherData.description || '—'}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>{weatherData.temp ?? '—'}°C</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Temperature</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          {[
            { label: 'Humidity', value: `${weatherData.humidity ?? '—'}%` },
            { label: 'Wind', value: `${weatherData.windSpeed ?? '—'} km/h` },
            { label: 'Forecast Risk', value: forecastWorst || 'Clear', color: weatherColor(forecastWorst) },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.color || '#f1f5f9' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 3-hour forecast */}
      {weatherData.forecast?.length > 0 && (
        <div className="card2">
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: '#94a3b8' }}>3-HOUR FORECAST</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {weatherData.forecast.map((f, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 18 }}>{weatherIcon(f.condition)}</div>
                <div style={{ fontSize: 10, color: weatherColor(f.condition), fontWeight: 600, marginTop: 2 }}>{f.condition}</div>
                <div style={{ fontSize: 9, color: '#475569' }}>{f.time?.slice(11, 16) || `+${(i + 1) * 3}h`}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Traffic Detail */}
      <div className="card2">
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: '#94a3b8' }}>LIVE TRAFFIC</div>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Congestion', value: `${Math.round((trafficData.congestion || 0) * 100)}%` },
            { label: 'Free-flow ETA', value: trafficData.durationMin ? `${trafficData.durationMin} min` : '—' },
            { label: 'Traffic ETA', value: trafficData.durationTrafficMin ? `${trafficData.durationTrafficMin} min` : '—' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <div className="risk-bar-track">
            <div className="risk-bar-fill" style={{
              width: `${Math.round((trafficData.congestion || 0) * 100)}%`,
              background: (trafficData.congestion || 0) > 0.7 ? '#ef4444' : (trafficData.congestion || 0) > 0.5 ? '#f59e0b' : '#22c55e',
            }} />
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>
          Source: {trafficData.source === 'google' ? '✅ Google Maps API' : '⚠️ Time-of-day heuristic (add API key for live data)'}
        </div>
      </div>

      {/* Setup hint if no API keys */}
      {(apiStatus.weather !== 'live' || apiStatus.traffic !== 'google') && (
        <div className="alert-info" style={{ fontSize: 11 }}>
          💡 Add <b>OPENWEATHER_API_KEY</b> and <b>GOOGLE_MAPS_API_KEY</b> to <code>server/.env</code> for fully live data.
          Currently using intelligent heuristics as fallback.
        </div>
      )}
    </div>
  );
}
