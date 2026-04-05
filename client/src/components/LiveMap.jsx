import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
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
    } else if (shipments.length > 0) {
      const pts = shipments.map(s => [s.currentLocation.lat, s.currentLocation.lng]);
      if (pts.length > 0) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 8 });
    }
  }, [planResult?.origin?.lat, planResult?.destination?.lat]);
  return null;
}

export default function LiveMap({ shipments, selected, onSelect, planResult }) {
  return (
    <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%', borderRadius: 12 }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
      <MapFitter planResult={planResult} shipments={shipments} />

      {/* ── Plan result overlay ── */}
      {planResult && (
        <>
          <Marker position={[planResult.origin.lat, planResult.origin.lng]} icon={makeIcon('🟢', '#22c55e', 28)}>
            <Popup><div style={{ color: '#111', fontWeight: 700 }}>{planResult.origin.formattedAddress}</div></Popup>
          </Marker>
          <Marker position={[planResult.destination.lat, planResult.destination.lng]} icon={makeIcon('🔴', '#ef4444', 28)}>
            <Popup><div style={{ color: '#111', fontWeight: 700 }}>{planResult.destination.formattedAddress}</div></Popup>
          </Marker>

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
          {!planResult.directionsData && (
            <Polyline
              positions={[[planResult.origin.lat, planResult.origin.lng], [planResult.destination.lat, planResult.destination.lng]]}
              pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.7, dashArray: '8 4' }}
            />
          )}
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
