import { useState, useEffect, useRef, useCallback } from 'react';
import { analyzeRoutes }    from '../services/routeAnalyzer';
import { scoreRoutes }      from '../services/routeScorer';
import { buildRouteAlerts } from '../services/riskEngine';

const REFRESH_MS       = 5 * 60 * 1000; // 5 min live monitoring
const REROUTE_THRESHOLD = 0.15;          // 15% score improvement triggers notification

export function useRouteWeather(polyline, durationMin = 0, allRoutes = null, departureTime = null) {
  const [segments,      setSegments]      = useState([]);   // enriched per-point data (traffic+weather)
  const [weatherPoints, setWeatherPoints] = useState([]);   // compat alias → same as segments
  const [routeAlerts,   setRouteAlerts]   = useState([]);
  const [routeAnalysis, setRouteAnalysis] = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [rerouteLoading,setRerouteLoading]= useState(false);
  const [error,         setError]         = useState(null);

  const timerRef        = useRef(null);
  const polylineKeyRef  = useRef(null);
  const departRef       = useRef(departureTime ?? Date.now());
  const prevScoreRef    = useRef(null);  // track score changes for reroute notification

  useEffect(() => {
    if (departureTime) departRef.current = departureTime;
  }, [departureTime]);

  // ── Fetch selected route segments (traffic + weather) ────────────────────
  const fetchSegments = useCallback(async (pl, durMin) => {
    if (!pl?.length) { setSegments([]); setWeatherPoints([]); setRouteAlerts([]); return; }
    setLoading(true);
    setError(null);
    try {
      const route   = { polyline: pl, durationMin: durMin, distanceKm: 0, routeIndex: 0 };
      const analysis = await analyzeRoutes([route], departRef.current);
      const segs    = analysis[0]?.segments || [];

      // build weatherPoints-compatible shape (existing components expect .weather + .riskInfo)
      const enriched = segs.map(s => ({
        ...s,
        riskInfo: s.wxRisk,
      }));

      setSegments(enriched);
      setWeatherPoints(enriched);
      setRouteAlerts(buildRouteAlerts(enriched));
    } catch (e) {
      setError('Failed to fetch route analysis');
      setSegments([]);
      setWeatherPoints([]);
      setRouteAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Analyze all routes + score them ──────────────────────────────────────
  const fetchAllRoutes = useCallback(async (routes, currentIdx) => {
    if (!routes?.length || routes.length < 1) { setRouteAnalysis(null); return; }
    setRerouteLoading(true);
    try {
      const analyses = await analyzeRoutes(routes, departRef.current);
      const scored   = scoreRoutes(analyses, currentIdx ?? 0);

      // Check 15% reroute threshold
      if (prevScoreRef.current !== null && scored.recommended !== (currentIdx ?? 0)) {
        const improvement = scored.improvementPct || 0;
        if (improvement >= REROUTE_THRESHOLD * 100) {
          scored._betterRouteAvailable = true;
          scored._betterReason         = scored.reason;
        }
      }
      prevScoreRef.current = scored.recommended;
      setRouteAnalysis(scored);
    } catch {
      setRouteAnalysis(null);
    } finally {
      setRerouteLoading(false);
    }
  }, []);

  // ── Main effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    const key = polyline?.length
      ? `${polyline[0]?.lat},${polyline[polyline.length - 1]?.lat},${polyline.length}`
      : null;

    if (key === polylineKeyRef.current) return;
    polylineKeyRef.current = key;
    clearInterval(timerRef.current);

    if (!polyline?.length) {
      setSegments([]); setWeatherPoints([]); setRouteAlerts([]); setRouteAnalysis(null);
      setLoading(false);
      return;
    }

    departRef.current = departureTime ?? Date.now();

    fetchSegments(polyline, durationMin);
    fetchAllRoutes(allRoutes?.length ? allRoutes : [{ polyline, durationMin, distanceKm: 0 }], 0);

    timerRef.current = setInterval(() => {
      departRef.current = Date.now();
      fetchSegments(polyline, durationMin);
      fetchAllRoutes(allRoutes?.length ? allRoutes : [{ polyline, durationMin, distanceKm: 0 }], 0);
    }, REFRESH_MS);

    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polyline, durationMin, allRoutes]);

  // ── Derived counts (backward compat) ─────────────────────────────────────
  const wxCounts = segments.reduce(
    (acc, s) => {
      const k = s.wxRisk?.key || s.riskInfo?.key || 'safe';
      if (k === 'high' || k === 'severe') acc.high++;
      else if (k === 'medium') acc.medium++;
      else if (k === 'light')  acc.light++;
      return acc;
    },
    { high: 0, medium: 0, light: 0 }
  );

  return {
    segments,
    weatherPoints,     // compat
    routeAlerts,
    routeAnalysis,
    loading,
    rerouteLoading,
    error,
    severeCount:   wxCounts.high,
    moderateCount: wxCounts.medium,
    lightCount:    wxCounts.light,
  };
}
