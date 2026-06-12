import { motion, AnimatePresence } from 'framer-motion';
import { weatherColor } from '../utils';
import {
  AlertTriangle, AlertCircle, Info, Zap, Bot, ArrowLeftRight, CheckCircle,
  CloudSun, CloudRain, Cloud, CloudLightning, Wind, X,
} from 'lucide-react';

function WeatherIcon({ w, size = 26 }) {
  const props = { size, strokeWidth: 1.8 };
  if (w === 'Rain' || w === 'Drizzle') return <CloudRain {...props} color="#60a5fa" />;
  if (w === 'Cloudy' || w === 'Clouds') return <Cloud {...props} color="#94a3b8" />;
  if (w === 'Storm' || w === 'Thunderstorm') return <CloudLightning {...props} color="#f87171" />;
  if (w === 'Fog' || w === 'Mist' || w === 'Haze') return <Wind {...props} color="#a78bfa" />;
  return <CloudSun {...props} color="#fcd34d" />;
}

// ── Animated alert item with slide-in from left ────────────────────────────────
function AlertItem({ alert, onDismiss }) {
  const cls  = alert.type === 'danger' ? 'alert-danger' : alert.type === 'warning' ? 'alert-warning' : 'alert-info';
  const Icon = alert.type === 'danger' ? AlertTriangle : alert.type === 'warning' ? AlertCircle : Info;
  const iconColor = alert.type === 'danger' ? '#f87171' : alert.type === 'warning' ? '#fcd34d' : '#60a5fa';

  return (
    <motion.div
      className={cls}
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        position: 'relative',
      }}
    >
      <Icon size={13} color={iconColor} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12, lineHeight: 1.5, flex: 1 }}>{alert.msg}</span>
      {onDismiss && (
        <button
          onClick={() => onDismiss(alert.id || alert.msg)}
          style={{
            background: 'none', border: 'none', color: 'var(--tx-3)',
            cursor: 'pointer', padding: 0, flexShrink: 0,
            opacity: 0.5, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
        >
          <X size={12} />
        </button>
      )}
    </motion.div>
  );
}

// ── Speedometer ───────────────────────────────────────────────────────────────
function Speedometer({ speed = 0, isNavigating = false }) {
  const MAX = 120;
  const pct = Math.min(speed / MAX, 1);

  const cx = 52, cy = 52, r = 40;
  const startAngle = -210;
  const sweepDeg   = 240;
  const endAngle   = startAngle + sweepDeg * pct;

  function polar(angle, radius = r) {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  const start = polar(startAngle);
  const end   = polar(endAngle);
  const large = sweepDeg * pct > 180 ? 1 : 0;

  const trackEnd = polar(startAngle + sweepDeg);
  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${trackEnd.x} ${trackEnd.y}`;

  const fillPath = pct > 0
    ? `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`
    : null;

  const needleAngle = startAngle + sweepDeg * pct;
  const needleTip   = polar(needleAngle, r - 6);

  const speedColor = speed > 80 ? '#ef4444' : speed > 50 ? '#f59e0b' : '#22c55e';
  const label = isNavigating ? `${speed} km/h` : '— km/h';
  const statusLabel = !isNavigating
    ? 'Start navigation'
    : speed === 0 ? 'Stationary' : speed < 20 ? 'Slow' : speed < 60 ? 'Moving' : 'Fast';

  return (
    <div className="card2" style={{ textAlign: 'center', padding: '10px 8px' }}>
      <svg viewBox="0 0 104 80" width="100%" style={{ maxWidth: 110, display: 'block', margin: '0 auto' }}>
        <path d={trackPath} fill="none" stroke="var(--border)" strokeWidth="7" strokeLinecap="round" />
        {fillPath && (
          <path d={fillPath} fill="none" stroke={speedColor} strokeWidth="7" strokeLinecap="round"
            style={{ transition: 'stroke 0.4s, d 0.3s' }} />
        )}
        <circle cx={needleTip.x} cy={needleTip.y} r="3.5" fill={speedColor}
          style={{ transition: 'cx 0.3s, cy 0.3s, fill 0.4s' }} />
        <circle cx={cx} cy={cy} r="4" fill="var(--tx-3)" />
        <text x={cx} y={cy + 16} textAnchor="middle"
          style={{ fontSize: 13, fontWeight: 800, fill: speedColor, fontFamily: 'Inter, sans-serif',
            transition: 'fill 0.4s' }}>
          {isNavigating ? speed : '—'}
        </text>
      </svg>
      <div style={{ fontSize: 10, fontWeight: 700, color: speedColor, marginTop: 2,
        transition: 'color 0.4s' }}>
        {label}
      </div>
      <div style={{ fontSize: 9, color: 'var(--tx-3)', marginTop: 1 }}>{statusLabel}</div>
    </div>
  );
}

export default function AlertsPanel({ env, alerts, shipments = [], speed = 0, isNavigating = false }) {
  const autoSwitched = shipments.filter(s => s.autoSwitched && s.autoSwitchReason);

  // Dismiss handler (local state only for animation)
  function handleDismiss(alertId) {
    // In a real app, this would call a callback to remove from parent state
  }

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div className="card-hdr" style={{ marginBottom: 0 }}>
        <div className="card-title">
          <div className="ct-icon"><Zap size={13} color="#60a5fa" /></div>
          Live Conditions
        </div>
        {env.lastUpdated && (
          <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>
            {new Date(env.lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="divider" style={{ margin: '0' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <motion.div
          className="card2"
          style={{ textAlign: 'center' }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <WeatherIcon w={env.weather} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: weatherColor(env.weather) }}>
            {env.weather || 'Clear'}
          </div>
          {env.forecastWorst && env.forecastWorst !== env.weather && (
            <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 2 }}>→ {env.forecastWorst}</div>
          )}
          <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 2 }}>Weather</div>
        </motion.div>

        <Speedometer speed={speed} isNavigating={isNavigating} />
      </div>

      {autoSwitched.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="sec-lbl" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Bot size={11} /> Auto-Decision Engine
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {autoSwitched.map(s => (
              <div key={s.id} className="alert-warning" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <ArrowLeftRight size={13} color="#fcd34d" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{s.id}</div>
                  <div style={{ fontSize: 11, marginTop: 1 }}>{s.autoSwitchReason}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="sec-lbl">Active Alerts</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {alerts?.length > 0 ? (
          <AnimatePresence>
            {alerts.map((a, i) => (
              <AlertItem key={a.id || i} alert={a} onDismiss={handleDismiss} />
            ))}
          </AnimatePresence>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              fontSize: 12, color: 'var(--tx-3)', textAlign: 'center',
              padding: '10px 0', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 6,
            }}
          >
            <CheckCircle size={13} color="var(--green)" /> All routes clear
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}