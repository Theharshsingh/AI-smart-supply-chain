import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { LocateFixed, Maximize, Minimize } from 'lucide-react';
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

// Follows user's GPS position during navigation
function MapFollower({ gpsPosition, isNavigating }) {
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
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [gpsPosition, isNavigating, map]);
  return null;
}

// ── Recenter button error messages ───────────────────────────────────────────
const RECENTER_ERRORS = {
  1: 'Please allow location access.',
  2: 'Location not available.',
  3: 'Request timed out. Try again.',
  unsupported: 'Geolocation not supported in this browser.',
};

// Floating fullscreen toggle control — renders via portal into the Leaflet container
function FullscreenControl() {
  const map = useMap();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFullscreenChange() {
      const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(isFull);
      // Wait for browser transition to finish before invalidating map size
      setTimeout(() => map.invalidateSize(), 200);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, [map]);

  function toggleFullscreen() {
    const container = map.getContainer();
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      (container.requestFullscreen || container.webkitRequestFullscreen).call(container);
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
      {isFullscreen
        ? <Minimize size={16} strokeWidth={2} />
        : <Maximize size={16} strokeWidth={2} />
      }
    </button>,
    map.getContainer()
  );
}

// Floating "Recenter to my location" control — renders via portal into the Leaflet container
function RecenterControl({ onLocationFound }) {
  const map = useMap();
  const [isLoading, setIsLoading] = useState(false);

  function handleRecenter() {
    if (!navigator.geolocation) {
      toast.error(RECENTER_ERRORS.unsupported, { icon: '📍', duration: 4000 });
      return;
    }
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setIsLoading(false);
        map.flyTo([lat, lng], 15, { duration: 1.5 });
        onLocationFound?.({ lat, lng, accuracy: pos.coords.accuracy });
      },
      (err) => {
        setIsLoading(false);
        toast.error(RECENTER_ERRORS[err.code] || 'Location error.', { icon: '📍', duration: 4000 });
      },
      { timeout: 10000, maximumAge: 30000 }
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

export default function LiveMap({ shipments, selected, onSelect, planResult, gpsPosition, isNavigating, liveRoute }) {
  // Single recenter location — updated in-place, never duplicated
  const [recenterLocation, setRecenterLocation] = useState(null);

  return (
    <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%', borderRadius: 12 }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
      <MapFitter planResult={planResult} shipments={shipments} />
      <MapFollower gpsPosition={gpsPosition} isNavigating={isNavigating} />
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

      {/* ── Live navigation route (overrides planned route color) ── */}
      {isNavigating && liveRoute?.polyline?.length > 1 && (
        <Polyline
          positions={liveRoute.polyline.map(p => [p.lat, p.lng])}
          pathOptions={{ color: '#22d3ee', weight: 7, opacity: 0.85 }}
        />
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
