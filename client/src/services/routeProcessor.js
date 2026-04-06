/** Haversine distance in kilometres between two {lat,lng} points */
export function haversineKm(p1, p2) {
  const R = 6371;
  const lat1 = p1.lat, lon1 = p1.lng ?? p1.lon;
  const lat2 = p2.lat, lon2 = p2.lng ?? p2.lon;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Total route length in kilometres */
export function totalRouteKm(polyline) {
  let total = 0;
  for (let i = 1; i < polyline.length; i++) {
    total += haversineKm(polyline[i - 1], polyline[i]);
  }
  return total;
}

/**
 * Sample up to `maxPoints` evenly-spaced points from a polyline.
 *
 * @param {Array<{lat:number, lng:number}>} polyline
 * @param {number} durationMs  – total route travel time in ms (for ETA per point)
 * @param {number} maxPoints   – maximum sample count (default 12)
 * @param {number} minDistKm   – minimum km between samples (default 10)
 * @returns {Array<{lat, lng, distFromStartKm, etaMs}>}
 */
export function sampleRoutePoints(polyline, durationMs = 0, maxPoints = 12, minDistKm = 10) {
  if (!polyline?.length) return [];

  const totalKm = totalRouteKm(polyline);
  if (totalKm === 0) {
    return [{ lat: polyline[0].lat, lng: polyline[0].lng ?? polyline[0].lon, distFromStartKm: 0, etaMs: 0 }];
  }

  // Distribute step size so we get ~maxPoints evenly along the route
  const stepKm = Math.max(minDistKm, totalKm / maxPoints);

  const samples = [];
  let accumulated = 0;
  let routeDistSoFar = 0;

  // Always include origin
  samples.push({
    lat: polyline[0].lat,
    lng: polyline[0].lng ?? polyline[0].lon,
    distFromStartKm: 0,
    etaMs: 0,
  });

  for (let i = 1; i < polyline.length && samples.length < maxPoints - 1; i++) {
    const seg = haversineKm(polyline[i - 1], polyline[i]);
    accumulated += seg;
    routeDistSoFar += seg;

    if (accumulated >= stepKm) {
      samples.push({
        lat: polyline[i].lat,
        lng: polyline[i].lng ?? polyline[i].lon,
        distFromStartKm: parseFloat(routeDistSoFar.toFixed(1)),
        etaMs: totalKm > 0 ? (routeDistSoFar / totalKm) * durationMs : 0,
      });
      accumulated = 0;
    }
  }

  // Always include destination
  const last = polyline[polyline.length - 1];
  const lastLng = last.lng ?? last.lon;
  if (
    samples.length < maxPoints &&
    haversineKm(samples[samples.length - 1], { lat: last.lat, lng: lastLng }) > 1
  ) {
    samples.push({
      lat: last.lat,
      lng: lastLng,
      distFromStartKm: parseFloat(totalKm.toFixed(1)),
      etaMs: durationMs,
    });
  }

  return samples;
}
