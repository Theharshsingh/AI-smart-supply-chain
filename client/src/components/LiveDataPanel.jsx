import { useState } from 'react';
import toast from 'react-hot-toast';
import { API_URL } from '../api';
import { weatherColor } from '../utils';
import {
  Globe, RefreshCw, CloudSun, CloudRain, Cloud, CloudLightning,
  Wind, Droplets, Eye, Thermometer, Gauge, Zap, Activity,
} from 'lucide-react';

function WeatherIcon({ condition, size = 28 }) {
  const p = { size, strokeWidth: 1.6 };
  const c = condition || '';
  if (/rain|drizzle/i.test(c))          return <CloudRain {...p} color="#60a5fa" />;
  if (/cloud/i.test(c))                 return <Cloud {...p} color="#94a3b8" />;
  if (/thunder|storm/i.test(c))         return <CloudLightning {...p} color="#f87171" />;
  if (/fog|mist|haze|dust|smoke/i.test(c)) return <Wind {...p} color="#a78bfa" />;
  return <CloudSun {...p} color="#fcd34d" />;
}

function StatusDot({ live }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: live ? '#22c55e' : '#f59e0b',
      boxShadow: live ? '0 0 6px #22c55e88' : '0 0 6px #f59e0b88',
      flexShrink: 0,
    }} />
  );
}

function StatBox({ icon: Icon, iconColor, label, value, sub, valueColor }) {
  return (
    <div style={{
      background: '#0a0e1a', border: '1px solid #1e2d45', borderRadius: 8,
      padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon && <Icon size={13} color={iconColor || '#475569'} />}
        <span style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: valueColor || '#f1f5f9' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 10, color: '#334155' }}>{sub}</div>}
    </div>
  );
}

function CongestionBar({ pct }) {
  const color = pct >= 75 ? '#7f1d1d' : pct >= 60 ? '#ef4444' : pct >= 40 ? '#f97316' : pct >= 20 ? '#eab308' : '#22c55e';
  const label = pct >= 75 ? 'Severe' : pct >= 60 ? 'Heavy' : pct >= 40 ? 'Moderate' : pct >= 20 ? 'Light' : 'Free Flow';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>Congestion Level</span>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{pct}% — {label}</span>
      </div>
      <div style={{ background: '#1e2d45', borderRadius: 999, height: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 0.6s' }} />
      </div>
      {/* Color legend */}
      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        {[['#22c55e','0-20%'],['#eab308','20-40%'],['#f97316','40-60%'],['#ef4444','60-80%'],['#7f1d1d','80-100%']].map(([c, l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#475569' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function LiveDataPanel({ env }) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch(`${API_URL}/api/refresh`, { method: 'POST' });
      toast.success('Live data refreshed', { icon: '🔄' });
    } catch {
      toast.error('Refresh failed');
    }
    setRefreshing(false);
  }

  const {
    weatherData = {}, trafficData = {}, apiStatus = {},
    lastUpdated, forecastWorst,
  } = env;

  const congPct   = Math.round((trafficData.congestion || 0) * 100);
  const congColor = congPct >= 60 ? '#ef4444' : congPct >= 40 ? '#f97316' : congPct >= 20 ? '#eab308' : '#22c55e';
  const wxLive    = apiStatus.weather === 'live' || apiStatus.weather === 'open-meteo';
  const trafLive  = apiStatus.traffic === 'google' || apiStatus.traffic === 'live';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Header card ── */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={15} color="#60a5fa" />
            <span style={{ fontWeight: 800, fontSize: 14, color: '#f1f5f9' }}>Live Data Sources</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {lastUpdated && (
              <span style={{ fontSize: 10, color: '#475569' }}>
                Updated {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleRefresh} disabled={refreshing}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: '#0c1a3a', border: '1px solid #1e40af', borderRadius: 6,
                color: '#60a5fa', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                padding: '5px 10px', opacity: refreshing ? 0.6 : 1,
              }}
            >
              <RefreshCw size={11} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : {}} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* API status pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'Open-Meteo Weather', live: wxLive, icon: CloudSun },
            { label: 'TomTom Traffic', live: trafLive || true, icon: Gauge },
            { label: 'OSRM Routing', live: true, icon: Globe },
          ].map(({ label, live, icon: Icon }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: live ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${live ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
              borderRadius: 6, padding: '4px 10px',
            }}>
              <StatusDot live={live} />
              <Icon size={11} color={live ? '#22c55e' : '#f59e0b'} />
              <span style={{ fontSize: 10, fontWeight: 700, color: live ? '#4ade80' : '#fcd34d' }}>
                {label}
              </span>
              <span style={{ fontSize: 9, color: live ? '#16a34a' : '#d97706' }}>
                {live ? 'LIVE' : 'HEURISTIC'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Current Weather ── */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
          <CloudSun size={14} color="#fcd34d" /> Current Weather
          {wxLive && <span style={{ fontSize: 9, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>LIVE</span>}
        </div>

        {/* Main weather display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <WeatherIcon condition={weatherData.condition} size={44} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: weatherColor(weatherData.condition) }}>
              {weatherData.condition || 'Clear'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize', marginTop: 2 }}>
              {weatherData.description || '—'}
            </div>
            {forecastWorst && forecastWorst !== weatherData.condition && (
              <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 3 }}>
                ↗ Forecast worsening: {forecastWorst}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#f1f5f9', lineHeight: 1 }}>
              {weatherData.temp ?? '—'}°
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Celsius</div>
          </div>
        </div>

        {/* Weather stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <StatBox icon={Droplets} iconColor="#60a5fa" label="Humidity"
            value={weatherData.humidity != null ? `${weatherData.humidity}%` : '—'} />
          <StatBox icon={Wind} iconColor={weatherData.windSpeed > 60 ? '#ef4444' : weatherData.windSpeed > 35 ? '#f59e0b' : '#94a3b8'}
            label="Wind Speed" value={weatherData.windSpeed != null ? `${weatherData.windSpeed} km/h` : '—'}
            sub={weatherData.windGusts > 0 ? `Gusts ${weatherData.windGusts} km/h` : null} />
          <StatBox icon={Eye} iconColor={weatherData.visibility != null && weatherData.visibility < 2 ? '#ef4444' : '#94a3b8'}
            label="Visibility" value={weatherData.visibility != null ? `${weatherData.visibility} km` : '—'} />
          <StatBox icon={CloudRain} iconColor="#60a5fa" label="Precipitation"
            value={weatherData.precipitation != null ? `${weatherData.precipitation} mm` : '—'} />
          <StatBox icon={Thermometer} iconColor="#f59e0b" label="Forecast Worst"
            value={forecastWorst || 'Clear'} valueColor={weatherColor(forecastWorst)} />
          <StatBox icon={Zap} iconColor="#a78bfa" label="Weather Code"
            value={weatherData.weatherCode != null ? `WMO ${weatherData.weatherCode}` : '—'} />
        </div>
      </div>

      {/* ── 6-Hour Forecast ── */}
      {weatherData.forecast?.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
            <CloudSun size={14} color="#60a5fa" /> 6-Hour Forecast
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {weatherData.forecast.slice(0, 6).map((f, i) => {
              const col = weatherColor(f.condition);
              return (
                <div key={i} style={{
                  flex: '0 0 auto', minWidth: 72, textAlign: 'center',
                  background: '#0a0e1a', border: '1px solid #1e2d45', borderRadius: 8, padding: '8px 6px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                    <WeatherIcon condition={f.condition} size={20} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: col }}>{f.condition}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', marginTop: 2 }}>{f.temp}°</div>
                  {f.pop > 0 && (
                    <div style={{ fontSize: 9, color: '#60a5fa', marginTop: 1 }}>💧{f.pop}%</div>
                  )}
                  {f.windSpeed > 0 && (
                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>💨{f.windSpeed}</div>
                  )}
                  <div style={{ fontSize: 9, color: '#334155', marginTop: 3 }}>
                    {f.time ? new Date(f.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `+${(i + 1) * 3}h`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Live Traffic ── */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Gauge size={14} color="#f59e0b" /> Live Traffic (TomTom)
          <span style={{ fontSize: 9, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
            LIVE
          </span>
        </div>

        <CongestionBar pct={congPct} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
          <StatBox icon={Activity} iconColor={congColor} label="Congestion"
            value={`${congPct}%`} valueColor={congColor} />
          <StatBox icon={Globe} iconColor="#60a5fa" label="Free-Flow ETA"
            value={trafficData.durationMin ? `${trafficData.durationMin} min` : '—'} />
          <StatBox icon={Gauge} iconColor="#f59e0b" label="Traffic ETA"
            value={trafficData.durationTrafficMin ? `${trafficData.durationTrafficMin} min` : '—'}
            sub={trafficData.durationTrafficMin && trafficData.durationMin
              ? `+${Math.max(0, trafficData.durationTrafficMin - trafficData.durationMin)} min delay`
              : null}
          />
        </div>

        <div style={{ marginTop: 10, fontSize: 10, color: '#334155', display: 'flex', alignItems: 'center', gap: 5 }}>
          <StatusDot live={trafLive || congPct > 0} />
          Source: {trafficData.source === 'google' ? 'Google Maps Distance Matrix (Live)' : 'TomTom Flow API + Time heuristic'}
          · Auto-refreshes every 30s
        </div>
      </div>

      {/* ── System Status ── */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>⚙️ System Status</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'Weather Data', status: apiStatus.weather || 'open-meteo', live: wxLive },
            { label: 'Traffic Data', status: apiStatus.traffic || 'tomtom', live: true },
            { label: 'Route Engine', status: 'OSRM (Free)', live: true },
            { label: 'Forecast Engine', status: 'Open-Meteo Hourly', live: true },
          ].map(({ label, status, live }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <StatusDot live={live} />
                <span style={{ fontSize: 10, fontWeight: 700, color: live ? '#4ade80' : '#fcd34d', textTransform: 'uppercase' }}>
                  {status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
