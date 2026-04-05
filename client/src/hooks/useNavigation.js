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
 */
export function useNavigation(from, to) {
  const [isNavigating, setIsNavigating]       = useState(false);
  const [gpsPosition, setGpsPosition]         = useState(null);   // { lat, lng, accuracy }
  const [gpsError, setGpsError]               = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [liveRoute, setLiveRoute]             = useState(null);   // { polyline, steps, … }
  const [isRerouting, setIsRerouting]         = useState(false);

  const watchIdRef          = useRef(null);
  const lastReroutePosRef   = useRef(null);
  const liveRouteRef        = useRef(null);   // mirrors state for closure access
  const currentStepIdxRef   = useRef(0);

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

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
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
    lastReroutePosRef.current = null;
  }, []);

  // ── Initial route fetch when navigation starts ────────────────────────────
  useEffect(() => {
    if (!isNavigating || !from?.lat || !to?.lat) return;
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

    // Reroute if user has drifted 200 m from the last reroute anchor
    if (lastReroutePosRef.current && !isRerouting && to?.lat) {
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
    startNavigation,
    stopNavigation,
  };
}
