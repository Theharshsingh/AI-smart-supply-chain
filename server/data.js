require('dotenv').config();
const axios = require('axios');

const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

const NOMINATIM_HEADERS = {
  'User-Agent': 'AI-Logistics-App/1.0 (logistics@example.com)',
  'Accept-Language': 'en',
};

const CITIES = [
  { name: 'Mumbai',    lat: 19.0760, lng: 72.8777 },
  { name: 'Delhi',     lat: 28.6139, lng: 77.2090 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Chennai',   lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata',   lat: 22.5726, lng: 88.3639 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Pune',      lat: 18.5204, lng: 73.8567 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
];

const HISTORICAL_DATA = {
  'Mumbai-Delhi':     { avgDelay: 0.30, peakHours: [8, 18, 19] },
  'Delhi-Bangalore':  { avgDelay: 0.20, peakHours: [9, 17, 18] },
  'Mumbai-Bangalore': { avgDelay: 0.25, peakHours: [8, 19] },
  'Chennai-Kolkata':  { avgDelay: 0.40, peakHours: [7, 18, 20] },
  'default':          { avgDelay: 0.20, peakHours: [8, 18] },
};

function getHistoricalData(origin, dest) {
  return HISTORICAL_DATA[`${origin}-${dest}`] || HISTORICAL_DATA['default'];
}

function interpolate(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function randomBetween(a, b) { return Math.random() * (b - a) + a; }

function randomCity(exclude) {
  const list = CITIES.filter(c => c.name !== exclude?.name);
  return list[Math.floor(Math.random() * list.length)];
}

// Decode Google encoded polyline
function decodePolyline(encoded) {
  const pts = [];
  let idx = 0, lat = 0, lng = 0;
  while (idx < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    pts.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return pts;
}

// Parse address into fallback queries: "Hirapur Etwarinagar Dhanbad" → [full, "Hirapur Dhanbad", "Dhanbad"]
function buildFallbackQueries(query) {
  const parts = query.trim().split(/\s+/).filter(Boolean);
  const queries = [query];
  if (parts.length >= 3) {
    // Try first word + last word (area + city)
    queries.push(`${parts[0]} ${parts[parts.length - 1]}, India`);
    // Try last word only (city fallback)
    queries.push(`${parts[parts.length - 1]}, India`);
  } else if (parts.length === 2) {
    queries.push(`${parts[parts.length - 1]}, India`);
  }
  return [...new Set(queries)];
}

// Geocode a place name → { lat, lng, formattedAddress, name } using Nominatim
async function geocodePlace(query, _placeId = null) {
  // If placeId is a Nominatim osm_id string like "N123456", extract lat/lng from it
  // (we store display_name as placeId for simplicity, so just geocode by query)
  try {
    const res = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: query, format: 'json', limit: 1, addressdetails: 1 },
      headers: NOMINATIM_HEADERS,
      timeout: 8000,
    });
    const r = res.data?.[0];
    if (!r) return null;
    const name = r.address?.city || r.address?.town || r.address?.village ||
                 r.address?.county || r.address?.state || r.display_name.split(',')[0];
    console.log(`[Geocode] "${query}" → ${r.display_name}`);
    return {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      formattedAddress: r.display_name,
      name,
      placeId: r.place_id?.toString(),
    };
  } catch (e) {
    console.error('[Geocode]', e.message);
    // Fallback to hardcoded cities
    const q = query.toLowerCase();
    const match = CITIES.find(c => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()));
    if (match) return { lat: match.lat, lng: match.lng, formattedAddress: match.name, name: match.name };
    return null;
  }
}

// Autocomplete using Nominatim search
async function getAutocompleteSuggestions(input) {
  try {
    const res = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: input, format: 'json', limit: 7, addressdetails: 1, countrycodes: 'in' },
      headers: NOMINATIM_HEADERS,
      timeout: 5000,
    });
    if (!res.data?.length) throw new Error('no results');
    return res.data.map(r => {
      const main = r.address?.city || r.address?.town || r.address?.village ||
                   r.address?.county || r.display_name.split(',')[0];
      const secondary = r.display_name.split(',').slice(1, 3).join(',').trim();
      return {
        description: r.display_name,
        placeId: r.display_name, // use display_name as stable key for geocoding
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        structured: { main, secondary },
      };
    });
  } catch (e) {
    console.error('[Autocomplete]', e.message);
    return CITIES.filter(c => c.name.toLowerCase().includes(input.toLowerCase()))
      .map(c => ({ description: c.name, placeId: c.name, lat: c.lat, lon: c.lng, structured: { main: c.name, secondary: 'India' } }));
  }
}

// GPS simulation: advance position along polyline points
function advanceAlongPolyline(polyline, currentProgress, speedFactor) {
  if (!polyline || polyline.length < 2) return { progress: currentProgress, location: null };
  const newProgress = Math.min(1, currentProgress + speedFactor);
  const idx = Math.floor(newProgress * (polyline.length - 1));
  const safeIdx = Math.min(idx, polyline.length - 1);
  return { progress: newProgress, location: polyline[safeIdx] };
}

function generateShipments(count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const origin = CITIES[i % CITIES.length];
    const dest = randomCity(origin);
    const progress = randomBetween(0.05, 0.75);
    return {
      id: `SHP-${1000 + i}`,
      origin: origin.name,
      destination: dest.name,
      originCoords: { lat: origin.lat, lng: origin.lng },
      destCoords: { lat: dest.lat, lng: dest.lng },
      currentLocation: interpolate(origin, dest, progress),
      progress,
      polyline: null, // filled when Google Directions available
      currentMode: ['ROAD', 'TRAIN', 'AIR'][i % 3],
      status: 'On-time',
      eta: Math.floor(randomBetween(2, 20)),
      riskScore: 20,
      cargo: ['Electronics', 'Pharmaceuticals', 'Automotive', 'FMCG', 'Textiles'][i % 5],
      weight: Math.floor(randomBetween(100, 5000)),
      autoSwitched: false,
      autoSwitchReason: null,
      weatherAtLocation: null,
      trafficAtRoute: null,
    };
  });
}

module.exports = {
  generateShipments, getHistoricalData, geocodePlace,
  getAutocompleteSuggestions, decodePolyline, interpolate,
  advanceAlongPolyline, CITIES, randomBetween,
};
