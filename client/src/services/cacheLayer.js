/** Simple in-memory TTL cache for weather API responses */

const _cache = new Map();
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    _cache.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  _cache.set(key, { value, expires: Date.now() + ttlMs });
}

/**
 * Round lat/lng to 1 decimal (~11 km grid) for cache key deduplication.
 * Points within ~11 km of each other will share a cached response.
 */
export function makeCacheKey(lat, lng) {
  return `${lat.toFixed(1)},${lng.toFixed(1)}`;
}

/** Remove stale entries — call periodically to avoid unbounded growth */
export function purgeExpired() {
  const now = Date.now();
  for (const [key, entry] of _cache) {
    if (now > entry.expires) _cache.delete(key);
  }
}
