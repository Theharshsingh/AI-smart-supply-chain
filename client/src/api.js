import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export const API_URL = 'http://localhost:4000';

export function useSocket() {
  const [data, setData] = useState({
    shipments: [],
    env: { traffic: 0.3, weather: 'Clear', forecastWorst: 'Clear', alerts: [], apiStatus: {}, weatherData: {}, trafficData: {} },
    alerts: [],
  });
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(API_URL);
    socketRef.current.on('update', payload => {
      setData({ shipments: payload.shipments, env: payload.env, alerts: payload.env?.alerts || [] });
    });
    return () => socketRef.current.disconnect();
  }, []);

  return data;
}

export async function fetchRoutes(shipmentId) {
  const res = await fetch(`${API_URL}/api/shipments/${shipmentId}/routes`);
  return res.json();
}

export async function switchRoute(shipmentId, routeId) {
  const res = await fetch(`${API_URL}/api/shipments/${shipmentId}/switch-route`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routeId }),
  });
  return res.json();
}

export async function planRoute(from, to, fromPlaceId = null, toPlaceId = null, fromCoords = null, toCoords = null) {
  const res = await fetch(`${API_URL}/api/route/plan`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, fromPlaceId, toPlaceId, fromCoords, toCoords }),
  });
  return res.json();
}

// Nominatim-powered autocomplete (no server proxy needed)
export async function fetchAutocomplete(q) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
      { headers: { 'Accept-Language': 'en-US,en;q=0.9' } }
    );
    const data = await res.json();
    return data.map(item => ({
      placeId: String(item.place_id),
      description: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      structured: {
        main: item.display_name.split(',')[0].trim(),
        secondary: item.display_name.split(',').slice(1, 3).join(',').trim(),
      },
    }));
  } catch {
    return [];
  }
}

// ── OSRM step instruction formatter ──────────────────────────────────────────
function formatOSRMInstruction(step) {
  const type = step.maneuver.type;
  const modifier = step.maneuver.modifier || 'straight';
  const name = step.name;
  const dir = modifier.replace(/-/g, ' ');

  if (type === 'depart') return name ? `Head towards ${name}` : 'Start your journey';
  if (type === 'arrive') return 'You have arrived at your destination';
  if (type === 'turn') return name ? `Turn ${dir} onto ${name}` : `Turn ${dir}`;
  if (type === 'continue' || type === 'new name') return name ? `Continue onto ${name}` : 'Continue straight';
  if (type === 'roundabout' || type === 'rotary') return `Take the roundabout${name ? ` onto ${name}` : ''}`;
  if (type === 'exit roundabout' || type === 'exit rotary') return name ? `Exit roundabout onto ${name}` : 'Exit the roundabout';
  if (type === 'merge') return name ? `Merge onto ${name}` : 'Merge';
  if (type === 'fork') return `Keep ${dir}${name ? ` onto ${name}` : ''}`;
  if (type === 'end of road') return `Turn ${dir}${name ? ` onto ${name}` : ''}`;
  return name ? `Continue on ${name}` : 'Continue straight';
}

// OSRM driving route with turn-by-turn steps
export async function fetchOSRMRoute(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    const route = data.routes[0];
    const leg = route.legs[0];

    const steps = (leg?.steps || []).map((step) => ({
      instruction: formatOSRMInstruction(step),
      distance: Math.round(step.distance),      // metres
      duration: Math.round(step.duration),      // seconds
      maneuverType: step.maneuver.type,
      maneuverModifier: step.maneuver.modifier || 'straight',
      location: step.maneuver.location,         // [lon, lat]
      streetName: step.name || '',
    }));

    return {
      polyline: route.geometry.coordinates.map(([lon, lat]) => ({ lat, lng: lon })),
      distanceKm: (route.distance / 1000).toFixed(1),
      durationMin: Math.round(route.duration / 60),
      steps,
    };
  } catch {
    return null;
  }
}

// ── Via-name generator: picks 2 representative road names from OSRM steps ─────
function generateViaName(steps) {
  const names = steps
    .map(s => s.name)
    .filter(n => n && n.length > 2 && !/^[\d\s\-]+$/.test(n));

  const seen = new Set();
  const unique = [];
  for (const n of names) {
    if (!seen.has(n)) { seen.add(n); unique.push(n); }
  }

  if (unique.length === 0) return 'main road';
  if (unique.length === 1) return unique[0];

  const first = unique[0];
  const mid = unique[Math.floor(unique.length / 2)];
  return mid !== first ? `${first}, ${mid}` : first;
}

// OSRM multi-route fetch with alternatives (for route selection panel)
export async function fetchOSRMRoutes(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;

    return data.routes.map((route, idx) => {
      const leg = route.legs[0];
      const steps = (leg?.steps || []).map((step) => ({
        instruction: formatOSRMInstruction(step),
        distance: Math.round(step.distance),
        duration: Math.round(step.duration),
        maneuverType: step.maneuver.type,
        maneuverModifier: step.maneuver.modifier || 'straight',
        location: step.maneuver.location,
        streetName: step.name || '',
      }));

      return {
        polyline: route.geometry.coordinates.map(([lon, lat]) => ({ lat, lng: lon })),
        distanceKm: (route.distance / 1000).toFixed(1),
        durationMin: Math.round(route.duration / 60),
        steps,
        viaName: generateViaName(leg?.steps || []),
        routeIndex: idx,
      };
    });
  } catch {
    return null;
  }
}

export async function triggerRefresh() {
  const res = await fetch(`${API_URL}/api/refresh`, { method: 'POST' });
  return res.json();
}

export async function fetchInsights(origin, dest) {
  const res = await fetch(`${API_URL}/api/insights/${encodeURIComponent(origin)}/${encodeURIComponent(dest)}`);
  return res.json();
}
