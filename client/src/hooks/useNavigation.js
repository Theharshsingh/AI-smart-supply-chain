import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchOSRMRoute } from '../api';

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

/**
 * useNavigation — manages GPS tracking, step advancement, and live rerouting.
 *
 * @param {{ lat: number, lon: number } | null} from  – starting coord
 * @param {{ lat: number, lon: number } | null} to    – destination coord
 * @param {{ polyline, steps, distanceKm, durationMin } | null} selectedRoute – locked route to navigate
 * @param {() => void} onArrived – called when driver is within 500m of destination
 */
export function useNavigation(from, to, selectedRoute = null, onArrived = null) {
  const [isNavigating, setIsNavigating]       = useState(false);
  const [gpsPosition, setGpsPosition]         = useState(null);   // { lat, lng, accuracy }
  const [gpsError, setGpsError]               = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [liveRoute, setLiveRoute]             = useState(null);   // { polyline, steps, … }
  const [isRerouting, setIsRerouting]         = useState(false);
  const [distToNextTurn, setDistToNextTurn]   = useState(null);   // metres to next maneuver
  const [speed, setSpeed]                     = useState(0);      // km/h, smoothed

  const watchIdRef          = useRef(null);
  const lastReroutePosRef   = useRef(null);
  const liveRouteRef        = useRef(null);
  const currentStepIdxRef   = useRef(0);
  const arrivedRef          = useRef(false);
  const onArrivedRef        = useRef(onArrived);
  // Speed tracking refs
  const prevPosRef          = useRef(null);   // { lat, lng, ts }
  const speedBufRef         = useRef([]);     // last 4 raw km/h values for smoothing
  useEffect(() => { onArrivedRef.current = onArrived; }, [onArrived]);

  // keep refs in sync
  useEffect(() => { liveRouteRef.current = liveRoute; }, [liveRoute]);
  useEffect(() => { currentStepIdxRef.current = currentStepIndex; }, [currentStepIndex]);

  // ── Start ────────────────────────────────────────────────────────────────
  const startNavigation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS is not supported in your browser');
      return;
    }
    if (!from?.lat || !to?.lat) {
      setGpsError('Please select start and destination first');
      return;
    }
    setIsNavigating(true);
    setCurrentStepIndex(0);
    setGpsError(null);
    setIsRerouting(false);
    arrivedRef.current = false;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat  = pos.coords.latitude;
        const lng  = pos.coords.longitude;
        const acc  = pos.coords.accuracy;
        const ts   = pos.timestamp;

        setGpsPosition({ lat, lng, accuracy: Math.round(acc) });

        // ── Speed calculation ──────────────────────────────────────────
        // Skip if accuracy is too poor (> 40 m)
        if (acc <= 40 && prevPosRef.current) {
          const dtSec = (ts - prevPosRef.current.ts) / 1000;
          // Skip if time delta too small (< 0.8 s) to avoid division noise
          if (dtSec >= 0.8) {
            const distM = haversine(
              prevPosRef.current.lat, prevPosRef.current.lng, lat, lng
            );
            const rawKmh = (distM / dtSec) * 3.6;
            // Clamp unrealistic spikes (> 200 km/h for road vehicles)
            const clampedKmh = rawKmh > 200 ? 0 : rawKmh;

            // Rolling average over last 4 readings
            const buf = speedBufRef.current;
            buf.push(clampedKmh);
            if (buf.length > 4) buf.shift();
            const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
            setSpeed(Math.round(avg));
          }
        }
        if (acc <= 40) {
          prevPosRef.current = { lat, lng, ts };
        }
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [from, to]);

  // ── Stop ─────────────────────────────────────────────────────────────────
  const stopNavigation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsNavigating(false);
    setGpsPosition(null);
    setLiveRoute(null);
    setCurrentStepIndex(0);
    setGpsError(null);
    setIsRerouting(false);
    setDistToNextTurn(null);
    setSpeed(0);
    prevPosRef.current    = null;
    speedBufRef.current   = [];
    lastReroutePosRef.current = null;
  }, []);

  // ── Initial route fetch when navigation starts ────────────────────────────
  useEffect(() => {
    if (!isNavigating || !from?.lat || !to?.lat) return;
    // Use the pre-selected route directly — do NOT re-fetch a different route
    if (selectedRoute?.steps?.length) {
      setLiveRoute(selectedRoute);
      lastReroutePosRef.current = { lat: from.lat, lng: from.lon ?? from.lng };
      return;
    }
    fetchOSRMRoute(from, to).then((route) => {
      if (route) {
        setLiveRoute(route);
        lastReroutePosRef.current = { lat: from.lat, lng: from.lon ?? from.lng };
      }
    });
  }, [isNavigating]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GPS update → advance step + maybe reroute ─────────────────────────────
  useEffect(() => {
    if (!gpsPosition || !liveRouteRef.current?.steps) return;

    const steps = liveRouteRef.current.steps;
    let idx = currentStepIdxRef.current;

    // Advance step if within 50 m of the next maneuver location
    for (let i = idx; i < steps.length; i++) {
      const [lon, lat] = steps[i].location;
      const dist = haversine(gpsPosition.lat, gpsPosition.lng, lat, lon);
      if (dist < 50) {
        idx = Math.min(i + 1, steps.length - 1);
      }
    }
    if (idx !== currentStepIdxRef.current) setCurrentStepIndex(idx);

    // Live distance to the current step's maneuver point
    if (steps[idx]?.location) {
      const [sLon, sLat] = steps[idx].location;
      setDistToNextTurn(Math.round(haversine(gpsPosition.lat, gpsPosition.lng, sLat, sLon)));
    }

    // ── Geofencing: auto-complete when within 500m of destination ──
    if (!arrivedRef.current && to?.lat && to?.lon) {
      const distToDest = haversine(gpsPosition.lat, gpsPosition.lng, to.lat, to.lon ?? to.lng);
      if (distToDest <= 500) {
        arrivedRef.current = true;
        onArrivedRef.current?.();
      }
    }

    // Reroute if user has drifted 200 m — disabled when locked to a selected route
    if (!selectedRoute && lastReroutePosRef.current && !isRerouting && to?.lat) {
      const drift = haversine(
        gpsPosition.lat,
        gpsPosition.lng,
        lastReroutePosRef.current.lat,
        lastReroutePosRef.current.lng
      );
      if (drift > 200) {
        lastReroutePosRef.current = { lat: gpsPosition.lat, lng: gpsPosition.lng };
        setIsRerouting(true);
        fetchOSRMRoute(
          { lat: gpsPosition.lat, lon: gpsPosition.lng },
          { lat: to.lat, lon: to.lon ?? to.lng }
        ).then((route) => {
          setIsRerouting(false);
          if (route) {
            setLiveRoute(route);
            setCurrentStepIndex(0);
          }
        });
      }
    }
  }, [gpsPosition]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  return {
    isNavigating,
    gpsPosition,
    gpsError,
    currentStepIndex,
    liveRoute,
    isRerouting,
    distToNextTurn,
    speed,
    startNavigation,
    stopNavigation,
  };
}
