import { useState, useEffect, lazy, Suspense, useMemo } from 'react';
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
import { CardSkeleton, MapSkeleton, KPISkeleton, AlertSkeleton } from './components/Skeleton';
import useCountUp from './hooks/useCountUp';
import {
  Map, Package, Truck, Shuffle, Brain, Globe,
  Rocket, LogOut, Search, Moon, Sun, X,
  CloudSun, CloudRain, Cloud, CloudLightning, Wind,
  TrafficCone, Bell, CheckCircle, Trash2, StopCircle,
  Loader2, Clock, Activity, TrendingUp, AlertTriangle,
  BarChart3, Shield,
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
} from 'recharts';

// Lazy load the 3D background for performance
const ThreeBackground = lazy(() => import('./components/ThreeBackground'));

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

// ── Mini sparkline chart for KPI cards using Recharts ─────────────────────────
function MiniSparkline({ data = [], color = '#3b82f6' }) {
  if (!data.length) {
    // Generate random heartbeat-like data for visual interest
    data = Array.from({ length: 12 }, (_, i) => ({
      v: 20 + Math.sin(i * 0.8) * 10 + Math.random() * 15,
    }));
  }
  return (
    <div className="kpi-sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-${color.replace('#', '')})`}
            dot={false}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── KPI Card with count-up animation + sparkline ──────────────────────────────
function KpiCard({ Icon, iconBg, iconColor, label, value, badge, badgeColor, badgeBg, sub, sparklineColor, sparklineData }) {
  const { count, ref } = useCountUp(typeof value === 'number' ? value : 0, 700);
  const sc = sparklineColor || iconColor;
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
      <div className="kpi-val" ref={ref}>{count}</div>
      <div className="kpi-lbl">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      <MiniSparkline color={sc} data={sparklineData} />
    </motion.div>
  );
}

// ── Live time pill ─────────────────────────────────────────────────────────────
function LiveTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hdr-pill">
      <div className="live-dot" style={{ width: 6, height: 6 }} />
      <span>{time.toLocaleTimeString()}</span>
    </div>
  );
}

// ── Bottom Sheet (mobile) ─────────────────────────────────────────────────────
function BottomSheet({ open, onClose, title, Icon, children }) {
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
  const [segments, setSegments] = useState([]);
  const [adjustedDurationMin, setAdjustedDurationMin] = useState(null);
  const [routesCongestion, setRoutesCongestion] = useState([]);
  const [dark, setDark]             = useState(false);
  const [navState, setNavState]     = useState({
    gpsPosition: null, isNavigating: false, liveRoute: null,
    currentStepIndex: 0, distToNextTurn: null, isRerouting: false,
    gpsError: null, onStopNavigation: null, speed: 0,
  });
  const [sheetOpen, setSheetOpen] = useState(false);

  const { history, addShipment, stopShipment, deleteShipment, completeShipment, updateLiveLocation } = useShipmentHistory();

  // ── All useMemo hooks must be BEFORE any early returns ────────────────────
  const sparklineData = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({ v: 30 + Math.sin(i * 0.8) * 15 + Math.random() * 20 })), []
  );
  const sparklineGreen = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({ v: 40 + Math.sin(i * 0.5 + 1) * 10 + Math.random() * 15 })), []
  );
  const sparklineAmber = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({ v: 25 + Math.sin(i * 0.7 + 2) * 12 + Math.random() * 10 })), []
  );
  const sparklineRed = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({ v: 15 + Math.sin(i * 0.6 + 3) * 8 + Math.random() * 12 })), []
  );

  // ── Early returns AFTER all hooks ─────────────────────────────────────────
  if (_isTracking) return <TrackingPage />;

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
      sparklineColor: '#60a5fa', sparklineData,
    },
    {
      Icon: CheckCircle, iconBg: 'rgba(34,197,94,0.15)', iconColor: '#4ade80',
      label: 'Delivered', value: onTime,
      badge: kpiSource.length ? `${onTimePct}%` : '—',
      badgeColor: '#4ade80', badgeBg: 'rgba(34,197,94,0.12)',
      sub: 'successfully delivered',
      sparklineColor: '#4ade80', sparklineData: sparklineGreen,
    },
    {
      Icon: Truck, iconBg: 'rgba(245,158,11,0.15)', iconColor: '#fcd34d',
      label: 'In Transit', value: atRisk,
      badge: atRisk > 0 ? 'Active' : 'None',
      badgeColor: atRisk > 0 ? '#fcd34d' : '#4ade80',
      badgeBg: atRisk > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
      sparklineColor: '#fcd34d', sparklineData: sparklineAmber,
    },
    {
      Icon: StopCircle, iconBg: 'rgba(239,68,68,0.15)', iconColor: '#f87171',
      label: 'Cancelled', value: delayed,
      badge: delayed > 0 ? 'Stopped' : 'None',
      badgeColor: delayed > 0 ? '#f87171' : '#4ade80',
      badgeBg: delayed > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
      sparklineColor: '#f87171', sparklineData: sparklineRed,
    },
    ...(autoSwitched > 0 ? [{ Icon: Shuffle, iconBg: 'rgba(167,139,250,0.15)', iconColor: '#a78bfa', label: 'Auto-Switched', value: autoSwitched, badge: 'By AI', badgeColor: '#a78bfa', badgeBg: 'rgba(167,139,250,0.12)', sparklineColor: '#a78bfa', sparklineData }] : []),
    ...(alerts?.length > 0 ? [{ Icon: Bell, iconBg: 'rgba(239,68,68,0.15)', iconColor: '#f87171', label: 'Live Alerts', value: alerts.length, badge: 'Real-time', badgeColor: '#f87171', badgeBg: 'rgba(239,68,68,0.12)', sparklineColor: '#f87171', sparklineData: sparklineRed }] : []),
  ];

  // ── Shared LiveMap ────────────────────────────────────────────────────────
  const liveMap = (
    <LiveMap
      shipments={[]} selected={selected} onSelect={setSelected}
      planResult={planResult ? { ...planResult, routesCongestion } : null}
      gpsPosition={navState.gpsPosition}
      isNavigating={navState.isNavigating}
      liveRoute={navState.liveRoute}
      currentStepIndex={navState.currentStepIndex}
      distToNextTurn={navState.distToNextTurn}
      isRerouting={navState.isRerouting}
      gpsError={navState.gpsError}
      onStopNavigation={navState.onStopNavigation}
      weatherPoints={weatherPoints}
      segments={segments}
      driverShipments={user.role === 'admin' ? driverShipments : []}
      adjustedDurationMin={adjustedDurationMin}
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
      onSegmentsUpdate={setSegments}
      onAdjustedDuration={(adjMin, congMap) => {
        setAdjustedDurationMin(adjMin);
        setRoutesCongestion(congMap || []);
      }}
    />
  );

  // Get user initials for avatar
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'SC';

  return (
    <div className="app-shell" data-theme={dark ? 'dark' : 'light'}>
      {/* ── 3D Animated Background ── */}
      <Suspense fallback={null}>
        <ThreeBackground />
      </Suspense>

      {/* ── Glow Rings ── */}
      <div className="glow-ring" style={{ top: '-10%', left: '-5%' }} />
      <div className="glow-ring" style={{ bottom: '-10%', right: '-5%' }} />

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
          <motion.div
            className="brand-icon"
            animate={{ boxShadow: ['0 0 16px rgba(59,130,246,0.4)', '0 0 24px rgba(59,130,246,0.6)', '0 0 16px rgba(59,130,246,0.4)'] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Rocket size={16} color="#fff" strokeWidth={2} />
          </motion.div>
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
          {/* User avatar + info */}
          <motion.div
            className="sidebar-user"
            whileHover={{ x: 2 }}
          >
            <div className="sidebar-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name">{user.name}</div>
              <div className="sidebar-user-role">{user.role}</div>
            </div>
          </motion.div>
          
          {/* Live status */}
          <div className="sys-status">
            <div className="live-dot" />
            <span style={{ fontSize: 11, color: 'var(--tx-2)', fontWeight: 500 }}>
              {env.apiStatus?.weather === 'live' ? 'Live APIs' : 'Heuristic Mode'}
            </span>
          </div>

          {/* Logout button */}
          <motion.button
            onClick={logout}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              width: '100%', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--r-md)', padding: '7px 12px',
              color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; }}
          >
            <LogOut size={13} /> Sign Out
          </motion.button>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div className="main-area">

        {/* ── Top Header ── */}
        <header className="top-bar">
          {/* Mobile: show brand */}
          {isMobile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="brand-icon" style={{ width: 28, height: 28 }}>
                <Rocket size={12} color="#fff" strokeWidth={2} />
              </div>
              <div className="brand-name" style={{ fontSize: 12 }}>SupplyChain</div>
            </div>
          ) : (
            <div className="top-bar-title">
              {(() => { const T = TABS.find(t => t.id === tab); return T ? <T.Icon size={16} strokeWidth={2} /> : null; })()}{' '}
              {TABS.find(t => t.id === tab)?.label}
            </div>
          )}

          <div className="top-bar-space" />

          {/* Weather pill */}
          <div className="hdr-pill" style={{ display: 'flex' }}>
            <WeatherIcon w={env.weather} size={13} />
            <span style={{ color: weatherColor(env.weather), fontWeight: 600 }}>{env.weather || 'Clear'}</span>
          </div>

          {/* Traffic pill — desktop only */}
          <div className="hdr-pill">
            <TrafficCone size={13} color={trafficPct > 70 ? 'var(--red)' : trafficPct > 50 ? 'var(--amber)' : 'var(--green)'} />
            <span style={{ fontWeight: 600, color: trafficPct > 70 ? 'var(--red)' : trafficPct > 50 ? 'var(--amber)' : 'var(--green)' }}>
              {trafficPct}% Traffic
            </span>
          </div>

          {/* Live time pill */}
          <LiveTime />

          {/* Theme toggle */}
          <motion.button
            className="theme-btn"
            onClick={() => setDark(d => !d)}
            title="Toggle theme"
            whileHover={{ rotate: 20, scale: 1.1 }}
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </motion.button>

          {/* Mobile logout button */}
          {isMobile && (
            <motion.button
              onClick={logout}
              whileTap={{ scale: 0.95 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8, padding: '5px 10px',
                color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <LogOut size={13} /> Logout
            </motion.button>
          )}
        </header>

        {/* ════════════════════════════════════════════════════════════════════
            MOBILE LAYOUT
            ════════════════════════════════════════════════════════════════════ */}
        {isMobile ? (
          <>
            {/* Plan tab: fullscreen map */}
            {tab === 'plan' && (
              <>
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

                <div className="mobile-map-fabs">
                  <button
                    className="mobile-fab"
                    onClick={() => setSheetOpen(true)}
                    title="Route Planner"
                  >
                    <Map size={20} color="var(--tx-1)" />
                  </button>
                </div>

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
                    {/* KPI grid with sparklines */}
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
                        <RiskChart shipments={shipments} env={env} />
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

            {/* KPI row with sparklines */}
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
                  <RiskChart shipments={shipments} env={env} />
                </div>
              </div>
            )}

          </main>
        )}
      </div>
    </div>
  );
}