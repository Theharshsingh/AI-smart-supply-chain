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
import AdminShipmentDashboard from './components/AdminShipmentDashboard';
import TrackingPage from './components/TrackingPage';
import LoginPage from './components/LoginPage';
import DriversPage from './components/DriversPage';
import { useShipmentHistory } from './hooks/useShipmentHistory';
import { useAuth } from './hooks/useAuth';
import { weatherColor } from './utils';
import {
  Map, Package, Truck, Shuffle, Brain, Globe,
  Rocket, LogOut, Search, Moon, Sun, X,
  CloudSun, CloudRain, Cloud, CloudLightning, Wind,
  TrafficCone, Bell, CheckCircle, Trash2, StopCircle,
  Loader2,
} from 'lucide-react';

// ── If ?tracking= param present, export TrackingPage directly ──────────────
const _isTracking = new URLSearchParams(window.location.search).get('tracking');

const TABS = [
  { id: 'plan',      label: 'Route Planner', Icon: Map,     roles: ['admin', 'driver'] },
  { id: 'dashboard', label: 'Shipments',     Icon: Package, roles: ['admin', 'driver'] },
  { id: 'drivers',   label: 'Drivers',       Icon: Truck,   roles: ['admin'] },
  { id: 'routes',    label: 'Routes',        Icon: Shuffle, roles: ['admin'] },
  { id: 'insights',  label: 'Insights',      Icon: Brain,   roles: ['admin'] },
  { id: 'livedata',  label: 'Live Data',     Icon: Globe,   roles: ['admin'] },
];

function WeatherIcon({ w, size = 14 }) {
  const props = { size, strokeWidth: 2 };
  if (w === 'Rain' || w === 'Drizzle') return <CloudRain {...props} />;
  if (w === 'Cloudy' || w === 'Clouds') return <Cloud {...props} />;
  if (w === 'Storm' || w === 'Thunderstorm') return <CloudLightning {...props} />;
  if (w === 'Fog' || w === 'Mist' || w === 'Haze') return <Wind {...props} />;
  return <CloudSun {...props} />;
}

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
function KpiCard({ Icon, iconBg, iconColor, label, value, badge, badgeColor, badgeBg, sub }) {
  return (
    <motion.div
      className="kpi-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.18 } }}
    >
      <div className="kpi-top">
        <div className="kpi-icon" style={{ background: iconBg }}>
          {Icon && <Icon size={17} color={iconColor} strokeWidth={2} />}
        </div>
        {badge && <span className="kpi-badge" style={{ color: badgeColor, background: badgeBg }}>{badge}</span>}
      </div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </motion.div>
  );
}

// ── Bottom Sheet (mobile) ─────────────────────────────────────────────────────
function BottomSheet({ open, onClose, title, Icon, children }) {
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
            {Icon && <Icon size={15} />}{title}
          </div>
          <button className="bottom-sheet-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="bottom-sheet-body">{children}</div>
      </div>
    </>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const { shipments, env, alerts, driverShipments } = useSocket();
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
  const [sheetOpen, setSheetOpen] = useState(false);

  const { history, addShipment, stopShipment, deleteShipment, completeShipment, updateLiveLocation } = useShipmentHistory();

  // ── Show public tracking page if ?tracking= param present ─────────────────────
  if (_isTracking) return <TrackingPage />;

  // ── Show login if not authenticated ─────────────────────────────────────────
  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: '#020817', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <Loader2 size={32} color="#3b82f6" style={{ marginBottom: 12, animation: 'spin 1s linear infinite' }} />
        <div>Loading…</div>
      </div>
    </div>
  );
  if (!user) return <LoginPage />;

  const visibleTabs = TABS.filter(t => t.roles.includes(user.role));

  function handleStartShipment({ from, to, toLat, toLon, fromLat, fromLon, distanceKm, durationMin, routeIdx }) {
    const id = `SHP-${Date.now()}`;
    addShipment({ id, from, to, fromLat, fromLon, toLat, toLon, distanceKm, durationMin, routeIdx, status: 'ongoing', startTime: new Date().toISOString(), endTime: null });
    toast.success('Shipment started! Track it in My Shipments.');
    return id;
  }

  function handleShipmentArrived(id) {
    completeShipment(id);
    toast.success('Delivery Successful! Shipment completed.', { duration: 5000 });
  }

  // ── KPI — admin uses driverShipments, driver uses own history ──────────────
  const kpiSource    = user.role === 'admin' ? driverShipments : history;
  const onTime       = kpiSource.filter(s => s.status === 'completed').length;
  const atRisk       = kpiSource.filter(s => s.status === 'ongoing').length;
  const delayed      = kpiSource.filter(s => s.status === 'cancelled').length;
  const autoSwitched = shipments.filter(s => s.autoSwitched).length;
  const onTimePct    = kpiSource.length ? Math.round(onTime / kpiSource.length * 100) : 0;
  const trafficPct   = Math.round((env.traffic || 0) * 100);
  const ongoingCount = user.role === 'admin'
    ? driverShipments.filter(s => s.status === 'ongoing').length
    : history.filter(s => s.status === 'ongoing').length;

  const hasRoute = !!(planResult?.origin && planResult?.destination);

  // ── KPI cards data — based on user's actual shipment history ─────────────
  const kpiCards = [
    {
      Icon: Package, iconBg: 'rgba(59,130,246,0.15)', iconColor: '#60a5fa',
      label: 'Total Orders', value: kpiSource.length,
      badge: `${ongoingCount} active`, badgeColor: '#60a5fa', badgeBg: 'rgba(59,130,246,0.12)',
    },
    {
      Icon: CheckCircle, iconBg: 'rgba(34,197,94,0.15)', iconColor: '#4ade80',
      label: 'Delivered', value: onTime,
      badge: kpiSource.length ? `${onTimePct}%` : '—',
      badgeColor: '#4ade80', badgeBg: 'rgba(34,197,94,0.12)',
      sub: 'successfully delivered',
    },
    {
      Icon: Truck, iconBg: 'rgba(245,158,11,0.15)', iconColor: '#fcd34d',
      label: 'In Transit', value: atRisk,
      badge: atRisk > 0 ? 'Active' : 'None',
      badgeColor: atRisk > 0 ? '#fcd34d' : '#4ade80',
      badgeBg: atRisk > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
    },
    {
      Icon: StopCircle, iconBg: 'rgba(239,68,68,0.15)', iconColor: '#f87171',
      label: 'Cancelled', value: delayed,
      badge: delayed > 0 ? 'Stopped' : 'None',
      badgeColor: delayed > 0 ? '#f87171' : '#4ade80',
      badgeBg: delayed > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
    },
    ...(autoSwitched > 0 ? [{ Icon: Shuffle, iconBg: 'rgba(167,139,250,0.15)', iconColor: '#a78bfa', label: 'Auto-Switched', value: autoSwitched, badge: 'By AI', badgeColor: '#a78bfa', badgeBg: 'rgba(167,139,250,0.12)' }] : []),
    ...(alerts?.length > 0 ? [{ Icon: Bell, iconBg: 'rgba(239,68,68,0.15)', iconColor: '#f87171', label: 'Live Alerts', value: alerts.length, badge: 'Real-time', badgeColor: '#f87171', badgeBg: 'rgba(239,68,68,0.12)' }] : []),
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
      driverShipments={user.role === 'admin' ? driverShipments : []}
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
          <div className="brand-icon"><Rocket size={16} color="#fff" strokeWidth={2} /></div>
          <div>
            <div className="brand-name">SupplyChain</div>
            <div className="brand-sub">Guardian Platform</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">Navigation</div>
          {visibleTabs.map(t => (
            <button
              key={t.id}
              className={`nav-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="ni"><t.Icon size={16} strokeWidth={2} /></span>
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
          {/* User info */}
          <div style={{ padding: '8px 12px', marginBottom: 6, borderRadius: 'var(--r-md)', background: 'var(--glass)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-1)' }}>{user.name}</div>
            <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 1, textTransform: 'capitalize' }}>{user.role}</div>
          </div>
          <div className="sys-status">
            <div className="live-dot" />
            <span style={{ fontSize: 11, color: 'var(--tx-2)', fontWeight: 500 }}>
              {env.apiStatus?.weather === 'live' ? 'Live APIs' : 'Heuristic Mode'}
            </span>
          </div>
          <button onClick={logout} style={{
            width: '100%', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--r-md)', padding: '7px 12px',
            color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div className="main-area">

        {/* ── Top Bar ── */}
        <header className="top-bar">
          {/* Mobile: show brand */}
          {isMobile ? (
            <div className="mobile-topbar-brand">
              <div className="brand-icon"><Rocket size={13} color="#fff" strokeWidth={2} /></div>
              <div className="brand-name">SupplyChain</div>
            </div>
          ) : (
            <div className="top-bar-title">
              {(() => { const T = TABS.find(t => t.id === tab); return T ? <T.Icon size={16} strokeWidth={2} /> : null; })()}{' '}
              {TABS.find(t => t.id === tab)?.label}
            </div>
          )}

          <div className="top-bar-space" />

          {/* Weather pill — always visible */}
          <div className="hdr-pill" style={{ display: 'flex' }}>
            <WeatherIcon w={env.weather} size={13} />
            <span style={{ color: weatherColor(env.weather), fontWeight: 600 }}>{env.weather || 'Clear'}</span>
          </div>

          {/* Traffic pill — desktop only (hidden via CSS) */}
          <div className="hdr-pill">
            <TrafficCone size={13} color={trafficPct > 70 ? 'var(--red)' : trafficPct > 50 ? 'var(--amber)' : 'var(--green)'} />
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
            {dark ? <Sun size={15} /> : <Moon size={15} />}
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
                    <span className="mobile-search-fab-icon"><Search size={16} color="var(--tx-3)" /></span>
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
                    <Map size={20} color="var(--tx-1)" />
                  </button>
                </div>

                {/* Bottom sheet: TripPlanner */}
                <BottomSheet
                  open={sheetOpen}
                  onClose={() => setSheetOpen(false)}
                  title="Route Planner"
                  Icon={Map}
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

                    {tab === 'drivers' && user.role === 'admin' && (
                      <DriversPage />
                    )}

                    {tab === 'dashboard' && (
                      user.role === 'admin' ? (
                        <AdminShipmentDashboard driverShipments={driverShipments} />
                      ) : (
                        <ShipmentDashboard
                          history={history}
                          onStop={id => { stopShipment(id); toast.success('Shipment stopped.'); }}
                          onDelete={id => { deleteShipment(id); toast.success('Shipment deleted.'); }}
                          onComplete={id => { completeShipment(id); toast.success('Delivery Successful!', { duration: 4000 }); }}
                        />
                      )
                    )}

                    {tab === 'routes' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="card">
                          <div className="card-hdr">
                            <div className="card-title"><div className="ct-icon"><Package size={13} color="#60a5fa" /></div>Select Shipment</div>
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
                            <div className="card-title"><div className="ct-icon"><Package size={13} color="#60a5fa" /></div>Select Shipment</div>
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
              {visibleTabs.map(t => (
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
                  <span className="m-icon"><t.Icon size={20} strokeWidth={2} /></span>
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

            {/* Drivers — admin only */}
            {tab === 'drivers' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <DriversPage />
              </motion.div>
            )}

            {/* My Shipments */}
            {tab === 'dashboard' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                {user.role === 'admin' ? (
                  <AdminShipmentDashboard driverShipments={driverShipments} />
                ) : (
                  <ShipmentDashboard
                    history={history}
                    onStop={id => { stopShipment(id); toast.success('Shipment stopped.'); }}
                    onDelete={id => { deleteShipment(id); toast.success('Shipment deleted.'); }}
                    onComplete={id => { completeShipment(id); toast.success('Delivery Successful!', { duration: 4000 }); }}
                  />
                )}
              </motion.div>
            )}

            {/* Routes */}
            {tab === 'routes' && (
              <div className="two-col-grid">
                <div className="card">
                  <div className="card-hdr">
                    <div className="card-title"><div className="ct-icon"><Package size={13} color="#60a5fa" /></div>Select Shipment</div>
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
                    <div className="card-title"><div className="ct-icon"><Package size={13} color="#60a5fa" /></div>Select Shipment</div>
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
