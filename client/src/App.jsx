import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { useSocket } from './api';
import LiveMap from './components/LiveMap';
import ShipmentList from './components/ShipmentList';
import RoutePanel from './components/RoutePanel';
import AlertsPanel from './components/AlertsPanel';
import InsightsPanel from './components/InsightsPanel';
import LiveDataPanel from './components/LiveDataPanel';
import RiskChart from './components/RiskChart';
import TripPlanner from './components/TripPlanner';
import ShipmentDashboard from './components/ShipmentDashboard';
import { useShipmentHistory } from './hooks/useShipmentHistory';
import { weatherIcon, weatherColor } from './utils';

const TABS = [
  { id: 'plan',      label: 'Route Planner',  icon: '🗺️' },
  { id: 'dashboard', label: 'My Shipments',   icon: '📦' },
  { id: 'routes',    label: 'Routes',         icon: '🔀' },
  { id: 'insights',  label: 'Insights',       icon: '🧠' },
  { id: 'livedata',  label: 'Live Data',      icon: '🌐' },
];

function KpiCard({ icon, iconBg, label, value, badge, badgeColor, badgeBg, sub }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <div className="kpi-icon" style={{ background: iconBg }}>{icon}</div>
        {badge && (
          <span className="kpi-badge" style={{ color: badgeColor, background: badgeBg }}>{badge}</span>
        )}
      </div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export default function App() {
  const { shipments, env, alerts } = useSocket();
  const [selected, setSelected]   = useState(null);
  const [tab, setTab]             = useState('plan');
  const [planResult, setPlanResult] = useState(null);
  const [dark, setDark]           = useState(false);
  const [navState, setNavState]   = useState({
    gpsPosition: null, isNavigating: false, liveRoute: null,
    currentStepIndex: 0, distToNextTurn: null, isRerouting: false,
    gpsError: null, onStopNavigation: null,
  });

  const { history, addShipment, stopShipment, deleteShipment, completeShipment } = useShipmentHistory();

  function handleStartShipment({ from, to, toLat, toLon, distanceKm, durationMin, routeIdx }) {
    const id = `SHP-${Date.now()}`;
    addShipment({ id, from, to, toLat, toLon, distanceKm, durationMin, routeIdx, status: 'ongoing', startTime: new Date().toISOString(), endTime: null });
    toast.success('Shipment started! Track it in My Shipments.', { icon: '📦' });
    return id;
  }

  function handleShipmentArrived(id) {
    completeShipment(id);
    toast.success('🏁 Delivery Successful! Shipment completed.', { duration: 5000, icon: '✅' });
  }

  const onTime       = shipments.filter(s => s.status === 'On-time').length;
  const atRisk       = shipments.filter(s => s.status === 'Risk').length;
  const delayed      = shipments.filter(s => s.status === 'Delayed').length;
  const avgRisk      = shipments.length ? Math.round(shipments.reduce((a, s) => a + s.riskScore, 0) / shipments.length) : 0;
  const autoSwitched = shipments.filter(s => s.autoSwitched).length;
  const onTimePct    = shipments.length ? Math.round(onTime / shipments.length * 100) : 0;
  const trafficPct   = Math.round((env.traffic || 0) * 100);
  const ongoingCount = history.filter(s => s.status === 'ongoing').length;

  return (
    <div className="app-shell" data-theme={dark ? 'dark' : 'light'}>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: 'var(--surface)', color: 'var(--tx-1)',
          border: '1px solid var(--border)', fontSize: 13,
          boxShadow: 'var(--sh-lg)',
        },
      }} />

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">🚀</div>
          <div>
            <div className="brand-name">SupplyChain</div>
            <div className="brand-sub">Guardian Platform</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">Navigation</div>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`nav-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="ni">{t.icon}</span>
              <span style={{ flex: 1 }}>{t.label}</span>
              {t.id === 'dashboard' && ongoingCount > 0 && (
                <span style={{
                  background: 'var(--green)', color: '#fff',
                  borderRadius: 999, fontSize: 9, fontWeight: 800,
                  padding: '1px 6px', lineHeight: 1.6,
                }}>{ongoingCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sys-status">
            <div className="live-dot" />
            <span style={{ fontSize: 11, color: 'var(--tx-2)', fontWeight: 500 }}>
              {env.apiStatus?.weather === 'live' ? 'Live APIs' : 'Heuristic Mode'}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-area">

        {/* ── Top bar ── */}
        <header className="top-bar">
          <div className="top-bar-title">
            {TABS.find(t => t.id === tab)?.icon}{' '}
            {TABS.find(t => t.id === tab)?.label}
          </div>
          <div className="top-bar-space" />

          <div className="hdr-pill">
            <span>{weatherIcon(env.weather)}</span>
            <span style={{ color: weatherColor(env.weather), fontWeight: 600 }}>{env.weather || 'Clear'}</span>
            {env.forecastWorst && env.forecastWorst !== env.weather && (
              <span style={{ color: 'var(--tx-3)' }}>→ {env.forecastWorst}</span>
            )}
          </div>

          <div className="hdr-pill">
            <span>🚦</span>
            <span style={{
              fontWeight: 600,
              color: trafficPct > 70 ? 'var(--red)' : trafficPct > 50 ? 'var(--amber)' : 'var(--green)',
            }}>
              {trafficPct}% Traffic
            </span>
          </div>

          {env.lastUpdated && (
            <div className="hdr-pill">
              <div className="live-dot" style={{ width: 6, height: 6 }} />
              <span>{new Date(env.lastUpdated).toLocaleTimeString()}</span>
            </div>
          )}

          <button className="theme-btn" onClick={() => setDark(d => !d)} title="Toggle theme">
            {dark ? '☀️' : '🌙'}
          </button>
        </header>

        {/* ── Page ── */}
        <main className="page">

          {/* KPI row */}
          <div className="kpi-grid">
            <KpiCard icon="📦" iconBg="var(--blue-50)"
              label="Total Shipments" value={shipments.length}
              badge={`${shipments.length} active`} badgeColor="var(--blue)" badgeBg="var(--blue-100)" />
            <KpiCard icon="✅" iconBg="var(--green-50)"
              label="On-Time" value={onTime}
              badge={`${onTimePct}%`} badgeColor="var(--green-700)" badgeBg="var(--green-100)"
              sub="of total fleet" />
            <KpiCard icon="⚠️" iconBg="var(--amber-50)"
              label="At Risk" value={atRisk}
              badge={atRisk > 0 ? 'Attention' : 'Clear'}
              badgeColor={atRisk > 0 ? 'var(--amber-700)' : 'var(--green-700)'}
              badgeBg={atRisk > 0 ? 'var(--amber-100)' : 'var(--green-100)'} />
            <KpiCard icon="🚨" iconBg="var(--red-50)"
              label="Delayed" value={delayed}
              badge={delayed > 0 ? 'Action needed' : 'None'}
              badgeColor={delayed > 0 ? 'var(--red-700)' : 'var(--green-700)'}
              badgeBg={delayed > 0 ? 'var(--red-100)' : 'var(--green-100)'} />
            <KpiCard icon="📊" iconBg="var(--violet-50)"
              label="Avg Risk" value={`${avgRisk}%`}
              badge={avgRisk > 60 ? 'High' : avgRisk > 40 ? 'Medium' : 'Low'}
              badgeColor={avgRisk > 60 ? 'var(--red-700)' : avgRisk > 40 ? 'var(--amber-700)' : 'var(--green-700)'}
              badgeBg={avgRisk > 60 ? 'var(--red-100)' : avgRisk > 40 ? 'var(--amber-100)' : 'var(--green-100)'} />
            {autoSwitched > 0 && (
              <KpiCard icon="🤖" iconBg="var(--violet-50)"
                label="Auto-Switched" value={autoSwitched}
                badge="By AI" badgeColor="var(--violet-700)" badgeBg="var(--violet-100)" />
            )}
            {alerts?.length > 0 && (
              <KpiCard icon="🔔" iconBg="var(--red-50)"
                label="Live Alerts" value={alerts.length}
                badge="Real-time" badgeColor="var(--red-700)" badgeBg="var(--red-100)" />
            )}
          </div>

          {/* ── Plan Route — always mounted to preserve state ── */}
          <div style={{ display: tab === 'plan' ? 'grid' : 'none', gridTemplateColumns: '1fr 400px', gap: 16, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="map-wrap" style={{ height: 460 }}>
                <LiveMap
                  shipments={[]} selected={selected} onSelect={setSelected}
                  planResult={planResult}
                  gpsPosition={navState.gpsPosition}
                  isNavigating={navState.isNavigating}
                  liveRoute={navState.liveRoute}
                  currentStepIndex={navState.currentStepIndex}
                  distToNextTurn={navState.distToNextTurn}
                  isRerouting={navState.isRerouting}
                  gpsError={navState.gpsError}
                  onStopNavigation={navState.onStopNavigation}
                />
              </div>
              <AlertsPanel env={env} alerts={alerts} shipments={shipments} />
            </div>
            <TripPlanner
              onPlanResult={setPlanResult}
              onNavStateChange={setNavState}
              onStartShipment={handleStartShipment}
              onShipmentArrived={handleShipmentArrived}
            />
          </div>

          {/* ── My Shipments ── */}
          {tab === 'dashboard' && (
            <ShipmentDashboard
              history={history}
              onStop={id => { stopShipment(id); toast.success('Shipment stopped.', { icon: '⏹️' }); }}
              onDelete={id => { deleteShipment(id); toast.success('Shipment deleted.', { icon: '🗑️' }); }}
              onComplete={id => { completeShipment(id); toast.success('🏁 Delivery Successful!', { icon: '✅', duration: 4000 }); }}
            />
          )}

          {/* ── Routes ── */}
          {tab === 'routes' && (
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
              <div className="card">
                <div className="card-hdr">
                  <div className="card-title"><div className="ct-icon">📦</div>Select Shipment</div>
                </div>
                <ShipmentList shipments={shipments} selected={selected} onSelect={setSelected} />
              </div>
              <RoutePanel shipment={selected} onRouteSwitch={() => {}} />
            </div>
          )}

          {/* ── Insights ── */}
          {tab === 'insights' && (
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
              <div className="card">
                <div className="card-hdr">
                  <div className="card-title"><div className="ct-icon">📦</div>Select Shipment</div>
                </div>
                <ShipmentList shipments={shipments} selected={selected} onSelect={setSelected} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <InsightsPanel shipment={selected} />
                <AlertsPanel env={env} alerts={alerts} shipments={shipments} />
              </div>
            </div>
          )}

          {/* ── Live Data ── */}
          {tab === 'livedata' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 960 }}>
              <LiveDataPanel env={env} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <AlertsPanel env={env} alerts={alerts} shipments={shipments} />
                <RiskChart shipments={shipments} />
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
