import { useState, useEffect, useRef, useCallback } from 'react';
import { sampleRoutePoints } from '../services/routeProcessor';
import { fetchWeatherForRoute } from '../services/weatherService';
import { addEtaTimestamps } from '../services/etaCalculator';
import { classifyRisk, buildRouteAlerts, routeWeatherScore } from '../services/riskEngine';
import { analyzeRoutes, getBestRoute } from '../services/reroutingEngine';

const REFRESH_INTERVAL_MS = 12 * 60 * 1000; // 12 minutes

/**
 * useRouteWeather
 * Monitors live + future weather conditions along a route polyline.
 * Supports alternative route comparison and auto-refresh.
 *
 * @param {Array<{lat,lng}>|null} polyline          – selected route polyline
 * @param {number}                durationMin       – selected route duration
 * @param {Array|null}            allRoutes         – all OSRM alternative routes (for rerouting)
 * @param {number}                departureTime     – Unix ms, default: Date.now()
 */
export function useRouteWeather(polyline, durationMin = 0, allRoutes = null, departureTime = null) {
  const [weatherPoints, setWeatherPoints] = useState([]);
  const [routeAlerts, setRouteAlerts]     = useState([]);
  const [routeAnalysis, setRouteAnalysis] = useState(null);   // alternative route analysis
  const [loading, setLoading]             = useState(false);
  const [rerouteLoading, setRerouteLoading] = useState(false);
  const [error, setError]                 = useState(null);

  const timerRef       = useRef(null);
  const polylineKeyRef = useRef(null);
  const departRef      = useRef(departureTime ?? Date.now());

  // Keep departure time stable (use "now" if not provided, update only when set explicitly)
  useEffect(() => {
    if (departureTime) departRef.current = departureTime;
  }, [departureTime]);

  // ── Primary route weather fetch ───────────────────────────────────────────
  const fetchWeather = useCallback(async (pl, durMin) => {
    if (!pl?.length) { setWeatherPoints([]); setRouteAlerts([]); return; }
    setLoading(true);
    setError(null);
    try {
      const durationMs = (durMin || 0) * 60 * 1000;
      const sampled    = sampleRoutePoints(pl, durationMs, 14, 10);
      const withEta    = addEtaTimestamps(sampled, departRef.current);
      const points     = await fetchWeatherForRoute(withEta, 3);

      // Enrich each point with classified risk
      const enriched = points.map(pt => ({
        ...pt,
        riskInfo: classifyRisk(pt.weather),
      }));

      setWeatherPoints(enriched);
      setRouteAlerts(buildRouteAlerts(enriched));
    } catch {
      setError('Failed to fetch route weather');
      setWeatherPoints([]);
      setRouteAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Alternative routes analysis ───────────────────────────────────────────
  const fetchRerouteAnalysis = useCallback(async (routes) => {
    if (!routes?.length || routes.length < 2) { setRouteAnalysis(null); return; }
    setRerouteLoading(true);
    try {
      const analyses = await analyzeRoutes(routes, departRef.current);
      const best     = getBestRoute(analyses, 0);
      setRouteAnalysis({ analyses, best });
    } catch {
      setRouteAnalysis(null);
    } finally {
      setRerouteLoading(false);
    }
  }, []);

  // ── Main effect — react to polyline changes ───────────────────────────────
  useEffect(() => {
    const key = polyline?.length
      ? `${polyline[0]?.lat},${polyline[polyline.length - 1]?.lat},${polyline.length}`
      : null;

    if (key === polylineKeyRef.current) return;
    polylineKeyRef.current = key;

    clearInterval(timerRef.current);

    if (!polyline?.length) {
      setWeatherPoints([]);
      setRouteAlerts([]);
      setRouteAnalysis(null);
      setLoading(false);
      return;
    }

    departRef.current = departureTime ?? Date.now();

    fetchWeather(polyline, durationMin);
    if (allRoutes?.length > 1) fetchRerouteAnalysis(allRoutes);

    timerRef.current = setInterval(() => {
      departRef.current = Date.now();   // update departure time on refresh
      fetchWeather(polyline, durationMin);
      if (allRoutes?.length > 1) fetchRerouteAnalysis(allRoutes);
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polyline, durationMin, allRoutes, fetchWeather, fetchRerouteAnalysis]);

  // ── Derived counts ────────────────────────────────────────────────────────
  const score       = routeWeatherScore(weatherPoints);
  const severeCount = score.highCount;       // backward compat alias
  const moderateCount = score.mediumCount;

  return {
    weatherPoints,
    routeAlerts,
    routeAnalysis,
    loading,
    rerouteLoading,
    error,
    hasRisk:      score.maxLevel !== 'safe',
    hasSevere:    score.highCount > 0,
    severeCount,
    moderateCount,
    lightCount:   score.lightCount,
    weatherScore: score,
  };
}
