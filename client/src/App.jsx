import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useSocket } from './api';
import LiveMap from './components/LiveMap';
import ShipmentList from './components/ShipmentList';
import RoutePanel from './components/RoutePanel';
import AlertsPanel from './components/AlertsPanel';
import InsightsPanel from './components/InsightsPanel';
import LiveDataPanel from './components/LiveDataPanel';
import RiskChart from './components/RiskChart';
import TripPlanner from './components/TripPlanner';
import { weatherIcon, weatherColor } from './utils';

const TABS = [
  { id: 'plan',      label: 'Plan Route',  icon: '🗺️' },
  { id: 'dashboard', label: 'Dashboard',   icon: '📦' },
  { id: 'routes',    label: 'Routes',      icon: '🔀' },
  { id: 'insights',  label: 'Insights',    icon: '🧠' },
  { id: 'livedata',  label: 'Live Data',   icon: '🌐' },
];

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card2" style={{ flex: 1, minWidth: 90 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || '#f1f5f9' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

export default function App() {
  const { shipments, env, alerts } = useSocket();
  const [selected, setSelected]   = useState(null);
  const [tab, setTab]             = useState('plan');
  const [planResult, setPlanResult] = useState(null);

  const onTime      = shipments.filter(s => s.status === 'On-time').length;
  const atRisk      = shipments.filter(s => s.status === 'Risk').length;
  const delayed     = shipments.filter(s => s.status === 'Delayed').length;
  const avgRisk     = shipments.length ? Math.round(shipments.reduce((a, s) => a + s.riskScore, 0) / shipments.length) : 0;
  const autoSwitched = shipments.filter(s => s.autoSwitched).length;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', display: 'flex', flexDirection: 'column' }}>
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1a2235', color: '#e2e8f0', border: '1px solid #1e2d45', fontSize: 13 },
      }} />

      {/* ── Header ── */}
      <header style={{
        background: '#111827', borderBottom: '1px solid #1e2d45',
        padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🚀</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
              AI Smart Logistics Platform
            </div>
            <div style={{ fontSize: 10, color: '#475569' }}>Real-Time · Multi-Modal · Autonomous Routing</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 18 }}>{weatherIcon(env.weather)}</span>
            <div>
              <span style={{ fontSize: 12, color: weatherColor(env.weather), fontWeight: 600 }}>{env.weather || 'Clear'}</span>
              {env.forecastWorst && env.forecastWorst !== env.weather && (
                <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>→ {env.forecastWorst}</span>
              )}
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#475569' }}>
            Traffic:{' '}
            <span style={{ fontWeight: 700, color: env.traffic > 0.7 ? '#ef4444' : env.traffic > 0.5 ? '#f59e0b' : '#22c55e' }}>
              {Math.round((env.traffic || 0) * 100)}%
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} className="pulse" />
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {env.apiStatus?.weather === 'live' ? '📡 Live APIs' : '⏱ Heuristic'}
            </span>
          </div>
          {env.lastUpdated && (
            <span style={{ fontSize: 10, color: '#334155' }}>
              {new Date(env.lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      {/* ── Nav ── */}
      <div style={{ background: '#111827', borderBottom: '1px solid #1e2d45', padding: '0 24px', display: 'flex', gap: 2 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 16px', fontSize: 13, fontWeight: 600,
            color: tab === t.id ? '#60a5fa' : '#64748b',
            borderBottom: tab === t.id ? '2px solid #3b82f6' : '2px solid transparent',
            transition: 'all 0.2s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <StatCard label="Shipments"    value={shipments.length} color="#60a5fa" />
          <StatCard label="On-Time"      value={onTime}  color="#22c55e" sub={`${Math.round(onTime / Math.max(1, shipments.length) * 100)}%`} />
          <StatCard label="At Risk"      value={atRisk}  color="#f59e0b" />
          <StatCard label="Delayed"      value={delayed} color="#ef4444" />
          <StatCard label="Avg Risk"     value={`${avgRisk}%`} color={avgRisk > 60 ? '#ef4444' : avgRisk > 40 ? '#f59e0b' : '#22c55e'} />
          {autoSwitched > 0 && <StatCard label="Auto-Switched" value={autoSwitched} color="#a78bfa" sub="By AI" />}
          {alerts?.length > 0 && <StatCard label="Live Alerts" value={alerts.length} color="#f87171" sub="Real-time" />}
        </div>

        {/* ── Plan Route tab ── */}
        {tab === 'plan' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 16, alignItems: 'start' }}>
            <TripPlanner onPlanResult={setPlanResult} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ height: 380 }}>
                <LiveMap shipments={shipments} selected={selected} onSelect={setSelected} planResult={planResult} />
              </div>
              <AlertsPanel env={env} alerts={alerts} shipments={shipments} />
            </div>
          </div>
        )}

        {/* ── Dashboard tab ── */}
        {tab === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
            <div className="card" style={{ padding: '10px 14px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📦 Active Shipments</div>
              <ShipmentList shipments={shipments} selected={selected} onSelect={setSelected} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ height: 420 }}>
                <LiveMap shipments={shipments} selected={selected} onSelect={setSelected} planResult={null} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <RiskChart shipments={shipments} />
                <AlertsPanel env={env} alerts={alerts} shipments={shipments} />
              </div>
            </div>
          </div>
        )}

        {/* ── Routes tab ── */}
        {tab === 'routes' && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
            <div className="card" style={{ padding: '10px 14px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Select Shipment</div>
              <ShipmentList shipments={shipments} selected={selected} onSelect={setSelected} />
            </div>
            <RoutePanel shipment={selected} onRouteSwitch={() => {}} />
          </div>
        )}

        {/* ── Insights tab ── */}
        {tab === 'insights' && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
            <div className="card" style={{ padding: '10px 14px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Select Shipment</div>
              <ShipmentList shipments={shipments} selected={selected} onSelect={setSelected} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <InsightsPanel shipment={selected} />
              <AlertsPanel env={env} alerts={alerts} shipments={shipments} />
            </div>
          </div>
        )}

        {/* ── Live Data tab ── */}
        {tab === 'livedata' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 1000 }}>
            <LiveDataPanel env={env} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <AlertsPanel env={env} alerts={alerts} shipments={shipments} />
              <RiskChart shipments={shipments} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
