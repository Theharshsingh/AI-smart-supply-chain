import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import TrackingPage from './components/TrackingPage';
import { useShipmentHistory } from './hooks/useShipmentHistory';
import { weatherIcon, weatherColor } from './utils';

// ── If ?tracking= param present, export TrackingPage directly ──────────────
const _isTracking = new URLSearchParams(window.location.search).get('tracking');

const TABS = [
  { id: 'plan',      label: 'Route Planner', icon: '🗺️' },
  { id: 'dashboard', label: 'Shipments',     icon: '📦' },
  { id: 'routes',    label: 'Routes',        icon: '🔀' },
  { id: 'insights',  label: 'Insights',      icon: '🧠' },
  { id: 'livedata',  label: 'Live Data',     icon: '🌐' },
];

// ── Detect mobile ─────────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = e => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, iconBg, label, value, badge, badgeColor, badgeBg, sub }) {
  return (
    <motion.div
      className="kpi-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.18 } }}
    >
      <div className="kpi-top">
        <div className="kpi-icon" style={{ background: iconBg }}>{icon}</div>
        {badge && <span className="kpi-badge" style={{ color: badgeColor, background: badgeBg }}>{badge}</span>}
      </div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </motion.div>
  );
}

// ── Bottom Sheet (mobile) ─────────────────────────────────────────────────────
function BottomSheet({ open, onClose, title, icon, children }) {
  // Prevent body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`}>
        <div className="bottom-sheet-handle" />
        <div className="bottom-sheet-header">
          <div className="bottom-sheet-title">
            <span>{icon}</span>{title}
          </div>
          <button className="bottom-sheet-close" onClick={onClose}>✕</button>
        </div>
        <div className="bottom-sheet-body">{children}</div>
      </div>
    </>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  // ── Show public tracking page if ?tracking= param present ─────────────────────
  if (_isTracking) return <TrackingPage />;

  const { shipments, env, alerts } = useSocket();
  const isMobile = useIsMobile();

  const [selected, setSelected]     = useState(null);
  const [tab, setTab]               = useState('plan');
  const [planResult, setPlanResult] = useState(null);
  const [weatherPoints, setWeatherPoints] = useState([]);
  const [dark, setDark]             = useState(false);
  const [navState, setNavState]     = useState({
    gpsPosition: null, isNavigating: false, liveRoute: null,
    currentStepIndex: 0, distToNextTurn: null, isRerouting: false,
    gpsError: null, onStopNavigation: null, speed: 0,
  });

  // Mobile sheet state
  const [sheetOpen, setSheetOpen] = useState(false);

  const { history, addShipment, stopShipment, deleteShipment, completeShipment } = useShipmentHistory();

  function handleStartShipment({ from, to, toLat, toLon, fromLat, fromLon, distanceKm, durationMin, routeIdx }) {
    const id = `SHP-${Date.now()}`;
    addShipment({ id, from, to, fromLat, fromLon, toLat, toLon, distanceKm, durationMin, routeIdx, status: 'ongoing', startTime: new Date().toISOString(), endTime: null });
    toast.success('Shipment started! Track it in My Shipments.', { icon: '📦' });
    return id;
  }

  function handleShipmentArrived(id) {
    completeShipment(id);
    toast.success('🏁 Delivery Successful! Shipment completed.', { duration: 5000, icon: '✅' });
  }

  const onTime       = history.filter(s => s.status === 'completed').length;
  const atRisk       = history.filter(s => s.status === 'ongoing').length;
  const delayed      = history.filter(s => s.status === 'cancelled').length;
  const avgRisk      = 0; // not applicable for user shipments
  const autoSwitched = shipments.filter(s => s.autoSwitched).length;
  const onTimePct    = history.length ? Math.round(onTime / history.length * 100) : 0;
  const trafficPct   = Math.round((env.traffic || 0) * 100);
  const ongoingCount = history.filter(s => s.status === 'ongoing').length;

  const hasRoute = !!(planResult?.origin && planResult?.destination);

  // ── KPI cards data — based on user's actual shipment history ─────────────
  const kpiCards = [
    {
      icon: '📦', iconBg: 'rgba(59,130,246,0.15)',
      label: 'Total Shipments', value: history.length,
      badge: `${ongoingCount} active`, badgeColor: '#60a5fa', badgeBg: 'rgba(59,130,246,0.12)',
    },
    {
      icon: '✅', iconBg: 'rgba(34,197,94,0.15)',
      label: 'Delivered', value: onTime,
      badge: history.length ? `${onTimePct}%` : '—',
      badgeColor: '#4ade80', badgeBg: 'rgba(34,197,94,0.12)',
      sub: 'successfully delivered',
    },
    {
      icon: '🚛', iconBg: 'rgba(245,158,11,0.15)',
      label: 'In Transit', value: atRisk,
      badge: atRisk > 0 ? 'Active' : 'None',
      badgeColor: atRisk > 0 ? '#fcd34d' : '#4ade80',
      badgeBg: atRisk > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
    },
    {
      icon: '❌', iconBg: 'rgba(239,68,68,0.15)',
      label: 'Cancelled', value: delayed,
      badge: delayed > 0 ? 'Stopped' : 'None',
      badgeColor: delayed > 0 ? '#f87171' : '#4ade80',
      badgeBg: delayed > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
    },
    ...(autoSwitched > 0 ? [{ icon: '🤖', iconBg: 'rgba(167,139,250,0.15)', label: 'Auto-Switched', value: autoSwitched, badge: 'By AI', badgeColor: '#a78bfa', badgeBg: 'rgba(167,139,250,0.12)' }] : []),
    ...(alerts?.length > 0 ? [{ icon: '🔔', iconBg: 'rgba(239,68,68,0.15)', label: 'Live Alerts', value: alerts.length, badge: 'Real-time', badgeColor: '#f87171', badgeBg: 'rgba(239,68,68,0.12)' }] : []),
  ];

  // ── Shared LiveMap ────────────────────────────────────────────────────────
  const liveMap = (
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
      weatherPoints={weatherPoints}
    />
  );

  // ── Shared TripPlanner ────────────────────────────────────────────────────
  const tripPlanner = (
    <TripPlanner
      onPlanResult={setPlanResult}
      onNavStateChange={setNavState}
      onStartShipment={handleStartShipment}
      onShipmentArrived={handleShipmentArrived}
      onWeatherUpdate={setWeatherPoints}
    />
  );

  return (
    <div className="app-shell" data-theme={dark ? 'dark' : 'light'}>
      <Toaster
        position={isMobile ? 'top-center' : 'top-right'}
        toastOptions={{
          style: {
            background: 'var(--surface)', color: 'var(--tx-1)',
            border: '1px solid var(--border)', fontSize: 13,
            boxShadow: 'var(--sh-lg)',
          },
        }}
      />

      {/* ── Desktop Sidebar ── */}
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
                <span style={{ background: 'var(--green)', color: '#fff', borderRadius: 999, fontSize: 9, fontWeight: 800, padding: '1px 6px', lineHeight: 1.6 }}>
                  {ongoingCount}
                </span>
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

      {/* ── Main Area ── */}
      <div className="main-area">

        {/* ── Top Bar ── */}
        <header className="top-bar">
          {/* Mobile: show brand */}
          {isMobile ? (
            <div className="mobile-topbar-brand">
              <div className="brand-icon">🚀</div>
              <div className="brand-name">SupplyChain</div>
            </div>
          ) : (
            <div className="top-bar-title">
              {TABS.find(t => t.id === tab)?.icon}{' '}
              {TABS.find(t => t.id === tab)?.label}
            </div>
          )}

          <div className="top-bar-space" />

          {/* Weather pill — always visible */}
          <div className="hdr-pill" style={{ display: 'flex' }}>
            <span>{weatherIcon(env.weather)}</span>
            <span style={{ color: weatherColor(env.weather), fontWeight: 600 }}>{env.weather || 'Clear'}</span>
          </div>

          {/* Traffic pill — desktop only (hidden via CSS) */}
          <div className="hdr-pill">
            <span>🚦</span>
            <span style={{ fontWeight: 600, color: trafficPct > 70 ? 'var(--red)' : trafficPct > 50 ? 'var(--amber)' : 'var(--green)' }}>
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

        {/* ════════════════════════════════════════════════════════════════════
            MOBILE LAYOUT
            ════════════════════════════════════════════════════════════════════ */}
        {isMobile ? (
          <>
            {/* Plan tab: fullscreen map */}
            {tab === 'plan' && (
              <>
                {/* Fullscreen map */}
                <div className="mobile-map-container">
                  <div className="map-wrap" style={{ height: '100%' }}>
                    {liveMap}
                  </div>
                </div>

                {/* Floating search bar */}
                {!navState.isNavigating && (
                  <div
                    className="mobile-search-fab"
                    onClick={() => setSheetOpen(true)}
                  >
                    <span className="mobile-search-fab-icon">🔍</span>
                    <div className="mobile-search-fab-text">
                      {planResult?.origin
                        ? `${planResult.origin.formattedAddress?.split(',')[0]} → ${planResult.destination?.formattedAddress?.split(',')[0] || '...'}`
                        : 'Search origin & destination…'
                      }
                    </div>
                    {hasRoute && <span style={{ fontSize: 11, color: 'var(--blue-bright)', fontWeight: 700 }}>✓</span>}
                  </div>
                )}

                {/* Floating action buttons */}
                <div className="mobile-map-fabs">
                  <button
                    className="mobile-fab"
                    onClick={() => setSheetOpen(true)}
                    title="Route Planner"
                  >
                    🗺️
                  </button>
                </div>

                {/* Bottom sheet: TripPlanner */}
                <BottomSheet
                  open={sheetOpen}
                  onClose={() => setSheetOpen(false)}
                  title="Route Planner"
                  icon="🗺️"
                >
                  {tripPlanner}
                </BottomSheet>
              </>
            )}

            {/* Other tabs: normal scrollable page */}
            {tab !== 'plan' && (
              <main className="page">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22 }}
                  >
                    {/* KPI grid */}
                    <div className="kpi-grid" style={{ marginBottom: 14 }}>
                      {kpiCards.map((k, i) => <KpiCard key={i} {...k} />)}
                    </div>

                    {tab === 'dashboard' && (
                      <ShipmentDashboard
                        history={history}
                        onStop={id => { stopShipment(id); toast.success('Shipment stopped.', { icon: '⏹️' }); }}
                        onDelete={id => { deleteShipment(id); toast.success('Shipment deleted.', { icon: '🗑️' }); }}
                        onComplete={id => { completeShipment(id); toast.success('🏁 Delivery Successful!', { icon: '✅', duration: 4000 }); }}
                      />
                    )}

                    {tab === 'routes' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="card">
                          <div className="card-hdr">
                            <div className="card-title"><div className="ct-icon">📦</div>Select Shipment</div>
                          </div>
                          <ShipmentList shipments={shipments} selected={selected} onSelect={setSelected} />
                        </div>
                        <RoutePanel shipment={selected} onRouteSwitch={() => {}} />
                      </div>
                    )}

                    {tab === 'insights' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="card">
                          <div className="card-hdr">
                            <div className="card-title"><div className="ct-icon">📦</div>Select Shipment</div>
                          </div>
                          <ShipmentList shipments={shipments} selected={selected} onSelect={setSelected} />
                        </div>
                        <InsightsPanel shipment={selected} />
                        <AlertsPanel env={env} alerts={alerts} shipments={shipments} speed={navState.speed} isNavigating={navState.isNavigating} />
                      </div>
                    )}

                    {tab === 'livedata' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <LiveDataPanel env={env} />
                        <AlertsPanel env={env} alerts={alerts} shipments={shipments} speed={0} isNavigating={false} />
                        <RiskChart shipments={shipments} />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </main>
            )}

            {/* Mobile Bottom Nav */}
            <nav className="mobile-bottom-nav">
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={`mobile-nav-btn ${tab === t.id ? 'active' : ''}`}
                  onClick={() => {
                    setTab(t.id);
                    if (t.id === 'plan') setSheetOpen(false);
                  }}
                >
                  {t.id === 'dashboard' && ongoingCount > 0 && (
                    <span className="mobile-nav-badge">{ongoingCount}</span>
                  )}
                  <span className="m-icon">{t.icon}</span>
                  <span className="m-label">{t.label}</span>
                </button>
              ))}
            </nav>
          </>
        ) : (
          /* ══════════════════════════════════════════════════════════════════
             DESKTOP LAYOUT
             ══════════════════════════════════════════════════════════════════ */
          <main className="page">

            {/* KPI row */}
            <div className="kpi-grid">
              {kpiCards.map((k, i) => <KpiCard key={i} {...k} />)}
            </div>

            {/* Plan Route — always mounted to preserve state */}
            <div style={{ display: tab === 'plan' ? 'grid' : 'none' }} className="plan-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="map-wrap" style={{ height: 460 }}>
                  {liveMap}
                </div>
                <AlertsPanel env={env} alerts={alerts} shipments={shipments} speed={navState.speed} isNavigating={navState.isNavigating} />
              </div>
              {tripPlanner}
            </div>

            {/* My Shipments */}
            {tab === 'dashboard' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <ShipmentDashboard
                  history={history}
                  onStop={id => { stopShipment(id); toast.success('Shipment stopped.', { icon: '⏹️' }); }}
                  onDelete={id => { deleteShipment(id); toast.success('Shipment deleted.', { icon: '🗑️' }); }}
                  onComplete={id => { completeShipment(id); toast.success('🏁 Delivery Successful!', { icon: '✅', duration: 4000 }); }}
                />
              </motion.div>
            )}

            {/* Routes */}
            {tab === 'routes' && (
              <div className="two-col-grid">
                <div className="card">
                  <div className="card-hdr">
                    <div className="card-title"><div className="ct-icon">📦</div>Select Shipment</div>
                  </div>
                  <ShipmentList shipments={shipments} selected={selected} onSelect={setSelected} />
                </div>
                <RoutePanel shipment={selected} onRouteSwitch={() => {}} />
              </div>
            )}

            {/* Insights */}
            {tab === 'insights' && (
              <div className="two-col-grid">
                <div className="card">
                  <div className="card-hdr">
                    <div className="card-title"><div className="ct-icon">📦</div>Select Shipment</div>
                  </div>
                  <ShipmentList shipments={shipments} selected={selected} onSelect={setSelected} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <InsightsPanel shipment={selected} />
                  <AlertsPanel env={env} alerts={alerts} shipments={shipments} speed={0} isNavigating={false} />
                </div>
              </div>
            )}

            {/* Live Data */}
            {tab === 'livedata' && (
              <div className="livedata-grid">
                <LiveDataPanel env={env} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <AlertsPanel env={env} alerts={alerts} shipments={shipments} speed={0} isNavigating={false} />
                  <RiskChart shipments={shipments} />
                </div>
              </div>
            )}

          </main>
        )}
      </div>
    </div>
  );
}
