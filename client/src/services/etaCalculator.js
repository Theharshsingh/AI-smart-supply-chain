/**
 * etaCalculator.js
 * Computes absolute ETA timestamps for each sampled route waypoint.
 *
 * The ETA of each waypoint = departure time + (fraction of total distance covered * total duration).
 * This gives us the wall-clock time a driver will reach that point, which we send to
 * the weather API so it can match the correct hourly forecast slot.
 */

/**
 * Enrich sampled route points with absolute ETA timestamps.
 *
 * @param {Array<{lat, lng, distFromStartKm, etaMs}>} sampledPoints  – from sampleRoutePoints()
 * @param {number} departureTime – Unix ms when the journey starts (default: now)
 * @returns {Array<{...point, etaTimestamp: number, etaFormatted: string}>}
 */
export function addEtaTimestamps(sampledPoints, departureTime = Date.now()) {
  return sampledPoints.map(pt => {
    const etaTimestamp = departureTime + (pt.etaMs || 0);
    return {
      ...pt,
      etaTimestamp,
      etaFormatted: formatEtaClock(etaTimestamp),
    };
  });
}

/**
 * Format a Unix-ms timestamp as a local time string: "2:15 PM"
 */
export function formatEtaClock(timestampMs) {
  return new Date(timestampMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Format a duration in minutes as a human-readable string: "1h 20m" | "45 min"
 */
export function formatDuration(totalMinutes) {
  if (totalMinutes < 60) return `${Math.round(totalMinutes)} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Check if the eta for a waypoint is within the next N hours from now.
 * Used to decide whether to use current weather vs. forecast.
 *
 * @param {number} etaTimestampMs
 * @param {number} thresholdHours – default 3
 */
export function isNearTerm(etaTimestampMs, thresholdHours = 3) {
  return etaTimestampMs - Date.now() < thresholdHours * 60 * 60 * 1000;
}
