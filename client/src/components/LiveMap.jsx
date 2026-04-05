import { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import {
  LocateFixed, Maximize2, Minimize2,
  ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight,
  RotateCcw, RotateCw, MapPin, Wifi, WifiOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { riskColor } from '../utils';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makeIcon(emoji, color, size = 32) {
  return L.divIcon({
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${size * 0.5}px;border:2px solid #0a0e1a;box-shadow:0 0 10px ${color}88;transition:all 0.3s">${emoji}</div>`,
    className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
  });
}

function shipmentIcon(mode, risk) {
  const color = riskColor(risk);
  const emoji = mode === 'AIR' ? '✈' : mode === 'TRAIN' ? '🚂' : '🚛';
  return makeIcon(emoji, color);
}

function pinIcon(color) {
  return L.divIcon({
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid #0a0e1a;box-shadow:0 0 6px ${color}"></div>`,
    className: '', iconSize: [14, 14], iconAnchor: [7, 7],
  });
}

/** Haversine distance in metres between two lat/lng points */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Auto-fit map to bounds when planResult changes
function MapFitter({ planResult, shipments }) {
  const map = useMap();
  useEffect(() => {
    if (planResult?.origin && planResult?.destination) {
      const route = planResult.directionsData?.[0];
      if (route?.polyline?.length > 1) {
        const bounds = L.latLngBounds(route.polyline.map(p => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        const bounds = L.latLngBounds(
          [planResult.origin.lat, planResult.origin.lng],
          [planResult.destination.lat, planResult.destination.lng]
        );
        map.fitBounds(bounds, { padding: [60, 60] });
      }
    } else if (planResult?.origin) {
      // Origin only (e.g. "Use Current Location" without destination yet)
      map.setView([planResult.origin.lat, planResult.origin.lng], 13, { animate: true });
    } else if (shipments.length > 0) {
      const pts = shipments.map(s => [s.currentLocation.lat, s.currentLocation.lng]);
      if (pts.length > 0) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 8 });
    }
  }, [planResult?.origin?.lat, planResult?.destination?.lat]);
  return null;
}

// Follows user's GPS position + smart zoom (close to turn → zoom in, far → zoom out)
function MapFollower({ gpsPosition, isNavigating, distToNextTurn }) {
  const map = useMap();
  const prevPosRef = useRef(null);
  useEffect(() => {
    if (!isNavigating || !gpsPosition) return;
    const { lat, lng } = gpsPosition;
    // Only fly if position changed meaningfully (> ~5m)
    if (
      prevPosRef.current &&
      Math.abs(prevPosRef.current.lat - lat) < 0.00005 &&
      Math.abs(prevPosRef.current.lng - lng) < 0.00005
    ) return;
    prevPosRef.current = { lat, lng };
    // Smart zoom based on distance to next maneuver
    let zoom = 15;
    if (distToNextTurn != null) {
      if (distToNextTurn < 80)       zoom = 17;
      else if (distToNextTurn < 200) zoom = 16;
      else if (distToNextTurn > 600) zoom = 14;
    }
    map.flyTo([lat, lng], zoom, { duration: 0.8 });
  }, [gpsPosition, isNavigating, map]);
  return null;
}

// ── Nav HUD helpers ───────────────────────────────────────────────────────────
function NavManeuverIcon({ type, modifier, size = 18, color = '#f1f5f9' }) {
  const props = { size, color, strokeWidth: 2.5 };
  const mod = modifier || 'straight';
  if (type === 'depart' || type === 'arrive')
    return <MapPin {...props} color={type === 'arrive' ? '#22c55e' : '#3b82f6'} />;
  if (type === 'roundabout' || type === 'rotary') return <RotateCcw {...props} />;
  if (type === 'exit roundabout' || type === 'exit rotary') return <RotateCw {...props} />;
  if (mod === 'left' || mod === 'sharp left') return <ArrowLeft {...props} />;
  if (mod === 'right' || mod === 'sharp right') return <ArrowRight {...props} />;
  if (mod === 'slight left') return <ArrowUpLeft {...props} />;
  if (mod === 'slight right') return <ArrowUpRight {...props} />;
  if (mod === 'uturn') return <RotateCcw {...props} />;
  return <ArrowUp {...props} />;
}

function fmtNavDist(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m} m`;
}
function fmtNavDur(s) {
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Split polyline into completed (grey) and remaining (blue) based on nearest GPS point */
function getRouteProgress(polyline, gpsPos) {
  if (!gpsPos || !polyline?.length) return { completed: [], remaining: polyline || [] };
  let closestIdx = 0, minDist = Infinity;
  polyline.forEach((pt, i) => {
    const d = haversine(gpsPos.lat, gpsPos.lng, pt.lat, pt.lng);
    if (d < minDist) { minDist = d; closestIdx = i; }
  });
  return {
    completed: polyline.slice(0, closestIdx + 1),
    remaining: polyline.slice(closestIdx),
  };
}

// ── Auto-enter / exit fullscreen when navigation starts / stops ───────────────
function NavFullscreenController({ isNavigating }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (isNavigating) {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        (container.requestFullscreen || container.webkitRequestFullscreen || (() => {})).call(container);
      }
    } else {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
      }
    }
    setTimeout(() => map.invalidateSize(), 300);
  }, [isNavigating, map]);
  return null;
}

// ── Google Maps–style navigation HUD overlaid on the map ─────────────────────
function NavHUD({ isNavigating, liveRoute, currentStepIndex, distToNextTurn, gpsPosition, gpsError, isRerouting, onStop }) {
  const map = useMap();
  if (!isNavigating) return null;

  const steps       = liveRoute?.steps || [];
  const currentStep = steps[currentStepIndex];
  const nextStep    = steps[currentStepIndex + 1];
  const arrived     = currentStep?.maneuverType === 'arrive';

  const remaining = steps.slice(currentStepIndex).reduce(
    (acc, s) => ({ dist: acc.dist + s.distance, dur: acc.dur + s.duration }),
    { dist: 0, dur: 0 }
  );

  const liveLabel = distToNextTurn != null
    ? `in ${fmtNavDist(distToNextTurn)}`
    : currentStep?.distance > 0 ? `in ${fmtNavDist(currentStep.distance)}` : '';

  return ReactDOM.createPortal(
    <div style={{ position: 'absolute', inset: 0, zIndex: 1050, pointerEvents: 'none', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top instruction bar ── */}
      <div style={{
        pointerEvents: 'auto',
        background: 'linear-gradient(135deg, rgba(12,26,58,0.97), rgba(30,27,75,0.97))',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(59,130,246,0.35)',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
      }}>
        {/* Maneuver icon */}
        <div style={{
          width: 48, height: 48, borderRadius: 12, flexShrink: 0,
          background: arrived ? '#052e16' : '#0c1a3a',
          border: `2px solid ${arrived ? '#22c55e' : '#3b82f6'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {steps.length === 0
            ? <span style={{ fontSize: 18 }}>⏳</span>
            : <NavManeuverIcon
                type={currentStep?.maneuverType}
                modifier={currentStep?.maneuverModifier}
                size={24}
                color={arrived ? '#22c55e' : '#60a5fa'}
              />
          }
        </div>

        {/* Instruction + distance */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {arrived ? (
            <div style={{ fontSize: 16, fontWeight: 800, color: '#4ade80' }}>🏁 You have arrived!</div>
          ) : steps.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Calculating route…</div>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentStep?.instruction}
              </div>
              {liveLabel && (
                <div style={{ fontSize: 13, color: '#60a5fa', fontWeight: 600, marginTop: 2 }}>{liveLabel}</div>
              )}
            </>
          )}
        </div>

        {/* Next turn preview */}
        {nextStep && !arrived && (
          <div style={{
            flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: '#111827', border: '1px solid #1e2d45', borderRadius: 8, padding: '6px 10px',
          }}>
            <span style={{ fontSize: 9, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>THEN</span>
            <NavManeuverIcon type={nextStep.maneuverType} modifier={nextStep.maneuverModifier} size={16} color="#64748b" />
          </div>
        )}

        {/* GPS / rerouting status */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          {isRerouting && (
            <div style={{ background: '#422006', border: '1px solid #92400e', borderRadius: 4, padding: '2px 7px', fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>
              Rerouting…
            </div>
          )}
          {gpsError ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#450a0a', border: '1px solid #991b1b', borderRadius: 4, padding: '2px 7px' }}>
              <WifiOff size={10} color="#f87171" />
              <span style={{ fontSize: 9, color: '#f87171', fontWeight: 600 }}>GPS Error</span>
            </div>
          ) : gpsPosition ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#052e16', border: '1px solid #166534', borderRadius: 4, padding: '2px 7px' }}>
              <Wifi size={10} color="#4ade80" />
              <span style={{ fontSize: 9, color: '#4ade80', fontWeight: 600 }}>GPS ±{gpsPosition.accuracy}m</span>
            </div>
          ) : (
            <div style={{ background: '#422006', border: '1px solid #92400e', borderRadius: 4, padding: '2px 7px', fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>
              Acquiring…
            </div>
          )}
        </div>
      </div>

      {/* ── Middle: map shows through (pointer-events off) ── */}
      <div style={{ flex: 1, pointerEvents: 'none' }} />

      {/* ── Bottom summary bar ── */}
      <div style={{
        pointerEvents: 'auto',
        background: 'rgba(17,24,39,0.95)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid #1e2d45',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', gap: 24, flex: 1 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{fmtNavDist(remaining.dist)}</div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Remaining</div>
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#22c55e', lineHeight: 1 }}>{fmtNavDur(remaining.dur)}</div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>ETA</div>
          </div>
        </div>
        {onStop && (
          <button
            onClick={onStop}
            style={{
              background: '#450a0a', border: '1px solid #991b1b', borderRadius: 8,
              color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            }}
          >
            ✕ Stop Navigation
          </button>
        )}
      </div>
    </div>,
    map.getContainer()
  );
}

// ── Recenter button error messages ───────────────────────────────────────────
const RECENTER_ERRORS = {
  1: 'Please allow location access.',
  2: 'Location not available.',
  3: 'Request timed out. Try again.',
  unsupported: 'Geolocation not supported in this browser.',
};

// Floating Fullscreen Toggle control — renders via portal into the Leaflet container
function FullscreenControl() {
  const map = useMap();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFsChange() {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(fsEl === map.getContainer());
      setTimeout(() => map.invalidateSize(), 200);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, [map]);

  function toggleFullscreen() {
    const container = map.getContainer();
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
    } else {
      (container.requestFullscreen || container.webkitRequestFullscreen || (() => {})).call(container);
    }
  }

  return ReactDOM.createPortal(
    <button
      onClick={toggleFullscreen}
      title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1100,
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: '#111827',
        border: '1px solid #1e2d45',
        boxShadow: '0 2px 14px rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: '#60a5fa',
        transition: 'background 0.2s, border-color 0.2s, color 0.2s',
        padding: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = '#1a2235';
        e.currentTarget.style.borderColor = '#3b82f6';
        e.currentTarget.style.color = '#93c5fd';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = '#111827';
        e.currentTarget.style.borderColor = '#1e2d45';
        e.currentTarget.style.color = '#60a5fa';
      }}
    >
      {isFullscreen ? <Minimize2 size={16} strokeWidth={2} /> : <Maximize2 size={16} strokeWidth={2} />}
    </button>,
    map.getContainer()
  );
}

// Floating "Recenter to my location" control — renders via portal into the Leaflet container
// Module-level flag prevents concurrent requests even if the component remounts during GPS updates.
let _recenterInFlight = false;

function RecenterControl({ onLocationFound }) {
  const map = useMap();
  const [isLoading, setIsLoading] = useState(false);

  // Sync local state with the module-level guard on mount
  useEffect(() => {
    if (!_recenterInFlight) setIsLoading(false);
  }, []);

  function handleRecenter() {
    if (_recenterInFlight) return;
    if (!navigator.geolocation) {
      toast.error(RECENTER_ERRORS.unsupported, { icon: '📍', id: 'recenter-err', duration: 4000 });
      return;
    }
    _recenterInFlight = true;
    setIsLoading(true);
    // Dismiss any stale recenter toast before showing a new one
    toast.dismiss('recenter-err');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        _recenterInFlight = false;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setIsLoading(false);
        map.flyTo([lat, lng], 15, { duration: 1.5 });
        onLocationFound?.({ lat, lng, accuracy: pos.coords.accuracy });
      },
      (err) => {
        _recenterInFlight = false;
        setIsLoading(false);
        toast.error(RECENTER_ERRORS[err.code] || 'Location error.', { icon: '📍', id: 'recenter-err', duration: 4000 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  // Leaflet sets position:relative on its container — portal + absolute positioning works perfectly
  return ReactDOM.createPortal(
    <button
      onClick={handleRecenter}
      disabled={isLoading}
      title="Recenter map to my location"
      aria-label="Recenter map to my location"
      style={{
        position: 'absolute',
        top: 80,        // below Leaflet's default zoom control (top-left)
        right: 10,
        zIndex: 1000,
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: '#111827',
        border: '1px solid #1e2d45',
        boxShadow: '0 2px 14px rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isLoading ? 'not-allowed' : 'pointer',
        color: isLoading ? '#475569' : '#60a5fa',
        transition: 'background 0.2s, border-color 0.2s, color 0.2s',
        opacity: isLoading ? 0.7 : 1,
        padding: 0,
      }}
      onMouseEnter={e => {
        if (!isLoading) {
          e.currentTarget.style.background = '#1a2235';
          e.currentTarget.style.borderColor = '#3b82f6';
          e.currentTarget.style.color = '#93c5fd';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = '#111827';
        e.currentTarget.style.borderColor = '#1e2d45';
        e.currentTarget.style.color = isLoading ? '#475569' : '#60a5fa';
      }}
    >
      {isLoading
        ? <span className="spin-anim" style={{ fontSize: 16, lineHeight: 1, display: 'flex' }}>⟳</span>
        : <LocateFixed size={16} strokeWidth={2} />
      }
    </button>,
    map.getContainer()
  );
}

// Pulsing GPS user marker icon (navigation — blue)
function gpsUserIcon() {
  return L.divIcon({
    html: `
      <div style="position:relative;width:24px;height:24px">
        <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f620;border:2px solid #3b82f680;animation:pulse 1.8s infinite"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:#3b82f6;border:2px solid #fff;box-shadow:0 0 8px #3b82f6aa"></div>
      </div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// Recenter marker icon (purple — distinct from navigation blue dot)
function recenterUserIcon() {
  return L.divIcon({
    html: `
      <div style="position:relative;width:28px;height:28px">
        <div style="position:absolute;inset:0;border-radius:50%;background:#a78bfa18;border:2px solid #a78bfa60;animation:pulse 2s infinite"></div>
        <div style="position:absolute;inset:5px;border-radius:50%;background:#a78bfa;border:2px solid #fff;box-shadow:0 0 10px #a78bfaaa"></div>
      </div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function LiveMap({
  shipments, selected, onSelect, planResult,
  gpsPosition, isNavigating, liveRoute,
  currentStepIndex, distToNextTurn, isRerouting, gpsError, onStopNavigation,
}) {
  const [recenterLocation, setRecenterLocation] = useState(null);

  // Split live route into completed (grey) + remaining (cyan) based on nearest GPS point
  const routeProgress = useMemo(() => {
    if (!isNavigating || !liveRoute?.polyline?.length || !gpsPosition) return null;
    return getRouteProgress(liveRoute.polyline, gpsPosition);
  }, [isNavigating, liveRoute, gpsPosition]);

  return (
    <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%', borderRadius: 12 }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
      <MapFitter planResult={planResult} shipments={shipments} />
      <MapFollower gpsPosition={gpsPosition} isNavigating={isNavigating} distToNextTurn={distToNextTurn} />
      <NavFullscreenController isNavigating={isNavigating} />
      <NavHUD
        isNavigating={isNavigating}
        liveRoute={liveRoute}
        currentStepIndex={currentStepIndex}
        distToNextTurn={distToNextTurn}
        gpsPosition={gpsPosition}
        gpsError={gpsError}
        isRerouting={isRerouting}
        onStop={onStopNavigation}
      />
      <FullscreenControl />
      <RecenterControl onLocationFound={setRecenterLocation} />

      {/* ── Plan result overlay ── */}
      {planResult && (
        <>
          {planResult.origin && (
            <Marker position={[planResult.origin.lat, planResult.origin.lng]} icon={makeIcon('🟢', '#22c55e', 28)}>
              <Popup><div style={{ color: '#111', fontWeight: 700 }}>{planResult.origin.formattedAddress}</div></Popup>
            </Marker>
          )}
          {planResult.destination && (
            <Marker position={[planResult.destination.lat, planResult.destination.lng]} icon={makeIcon('🔴', '#ef4444', 28)}>
              <Popup><div style={{ color: '#111', fontWeight: 700 }}>{planResult.destination.formattedAddress}</div></Popup>
            </Marker>
          )}

          {/* OSRM / Directions polylines — color coded by traffic */}
          {planResult.directionsData?.map((route, i) => {
            const ratio = route.durationTrafficMin / Math.max(1, route.durationMin);
            const color = ratio > 1.4 ? '#ef4444' : ratio > 1.15 ? '#f97316' : '#22c55e';
            return (
              <Polyline key={i}
                positions={route.polyline.map(p => [p.lat, p.lng])}
                pathOptions={{ color, weight: i === 0 ? 6 : 3, opacity: i === 0 ? 0.9 : 0.45, dashArray: i === 0 ? null : '6 4' }}
              >
                {i === 0 && (
                  <Popup>
                    <div style={{ color: '#111', fontWeight: 600, fontSize: 13 }}>
                      🛣️ {route.distanceKm} km · {route.durationMin} min
                    </div>
                  </Popup>
                )}
              </Polyline>
            );
          })}

      {/* Fallback straight line */}
          {!planResult.directionsData && planResult.origin && planResult.destination && (
            <Polyline
              positions={[[planResult.origin.lat, planResult.origin.lng], [planResult.destination.lat, planResult.destination.lng]]}
              pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.7, dashArray: '8 4' }}
            />
          )}
        </>
      )}

      {/* ── Live navigation route: completed (grey) + remaining (cyan) ── */}
      {isNavigating && routeProgress ? (
        <>
          {routeProgress.completed.length > 1 && (
            <Polyline
              positions={routeProgress.completed.map(p => [p.lat, p.lng])}
              pathOptions={{ color: '#334155', weight: 6, opacity: 0.55 }}
            />
          )}
          {routeProgress.remaining.length > 1 && (
            <Polyline
              positions={routeProgress.remaining.map(p => [p.lat, p.lng])}
              pathOptions={{ color: '#22d3ee', weight: 7, opacity: 0.9 }}
            />
          )}
        </>
      ) : (
        isNavigating && liveRoute?.polyline?.length > 1 && (
          <Polyline
            positions={liveRoute.polyline.map(p => [p.lat, p.lng])}
            pathOptions={{ color: '#22d3ee', weight: 7, opacity: 0.85 }}
          />
        )
      )}

      {/* ── Recenter marker — single, updated in-place, hidden during active navigation ── */}
      {recenterLocation && !isNavigating && (
        <>
          <Circle
            center={[recenterLocation.lat, recenterLocation.lng]}
            radius={recenterLocation.accuracy || 30}
            pathOptions={{ color: '#a78bfa', fillColor: '#a78bfa20', fillOpacity: 1, weight: 1 }}
          />
          <Marker
            position={[recenterLocation.lat, recenterLocation.lng]}
            icon={recenterUserIcon()}
            zIndexOffset={900}
          >
            <Popup>
              <div style={{ color: '#111', fontWeight: 700, fontSize: 12 }}>
                📍 My Location
                {recenterLocation.accuracy && (
                  <div style={{ fontWeight: 400, fontSize: 11, color: '#555', marginTop: 2 }}>
                    Accuracy: ±{Math.round(recenterLocation.accuracy)}m
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        </>
      )}

      {/* ── GPS user position marker ── */}
      {gpsPosition && (
        <>
          <Circle
            center={[gpsPosition.lat, gpsPosition.lng]}
            radius={gpsPosition.accuracy || 20}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f620', fillOpacity: 1, weight: 1 }}
          />
          <Marker
            position={[gpsPosition.lat, gpsPosition.lng]}
            icon={gpsUserIcon()}
            zIndexOffset={1000}
          >
            <Popup>
              <div style={{ color: '#111', fontWeight: 700, fontSize: 12 }}>
                📍 Your Location
                {gpsPosition.accuracy && (
                  <div style={{ fontWeight: 400, fontSize: 11, color: '#555' }}>
                    Accuracy: ±{gpsPosition.accuracy}m
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        </>
      )}

      {/* ── Live shipments ── */}
      {shipments.map(s => {
        const color = riskColor(s.riskScore);
        const isSelected = selected?.id === s.id;
        const poly = s.polyline;

        return (
          <div key={s.id}>
            {/* Route: real polyline or straight line */}
            {poly && poly.length > 1 ? (
              <Polyline
                positions={poly.map(p => [p.lat, p.lng])}
                pathOptions={{ color, weight: isSelected ? 4 : 2, opacity: isSelected ? 0.85 : 0.45 }}
              />
            ) : (
              <Polyline
                positions={[
                  [s.originCoords.lat, s.originCoords.lng],
                  [s.currentLocation.lat, s.currentLocation.lng],
                  [s.destCoords.lat, s.destCoords.lng],
                ]}
                pathOptions={{ color, weight: isSelected ? 4 : 2, opacity: isSelected ? 0.85 : 0.4, dashArray: '8 4' }}
              />
            )}

            {/* Origin dot */}
            <CircleMarker center={[s.originCoords.lat, s.originCoords.lng]} radius={4}
              pathOptions={{ color: '#334155', fillColor: '#475569', fillOpacity: 1, weight: 1 }} />

            {/* Destination dot */}
            <CircleMarker center={[s.destCoords.lat, s.destCoords.lng]} radius={6}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.25, weight: 2 }} />

            {/* GPS moving marker */}
            <Marker
              position={[s.currentLocation.lat, s.currentLocation.lng]}
              icon={shipmentIcon(s.currentMode, s.riskScore)}
              eventHandlers={{ click: () => onSelect(s) }}
            >
              <Popup>
                <div style={{ background: '#111827', color: '#e2e8f0', padding: 10, borderRadius: 8, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{s.id}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.origin} → {s.destination}</div>
                  <div style={{ fontSize: 11, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div>Mode: <b style={{ color: '#60a5fa' }}>{s.currentMode}</b></div>
                    <div>Risk: <b style={{ color }}>{s.riskScore}%</b></div>
                    <div>ETA: <b>{s.eta}h</b></div>
                    <div>Status: <b style={{ color: s.status === 'On-time' ? '#22c55e' : s.status === 'Risk' ? '#f59e0b' : '#ef4444' }}>{s.status}</b></div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
                      GPS: {s.currentLocation.lat.toFixed(4)}, {s.currentLocation.lng.toFixed(4)}
                    </div>
                  </div>
                  {s.autoSwitched && (
                    <div style={{ marginTop: 6, fontSize: 10, color: '#f59e0b', background: '#422006', padding: '4px 8px', borderRadius: 4 }}>
                      {s.autoSwitchReason}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          </div>
        );
      })}
    </MapContainer>
  );
}
