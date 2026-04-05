import { useState, useRef, useCallback, useEffect } from 'react';
import { planRoute, fetchAutocomplete, fetchOSRMRoute } from '../api';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { riskColor, modeIcon, weatherIcon, weatherColor, fmtEta } from '../utils';
import { useNavigation } from '../hooks/useNavigation';
import NavigationPanel from './NavigationPanel';
import toast from 'react-hot-toast';
import { Navigation2, Square } from 'lucide-react';

// ── Autocomplete Input ────────────────────────────────────────────────────────
function PlaceInput({ label, icon, value, onChange, onSelect, error }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const selectedRef = useRef(false);

  const handleChange = useCallback(async (e) => {
    const v = e.target.value;
    onChange({ text: v, placeId: null, lat: null, lon: null }); // clear coords on manual type
    selectedRef.current = false;
    clearTimeout(timer.current);
    if (v.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const s = await fetchAutocomplete(v);
      setSuggestions(s);
      setOpen(s.length > 0);
      setLoading(false);
    }, 280);
  }, [onChange]);

  const handleSelect = useCallback((s) => {
    onChange({ text: s.description, placeId: s.placeId, lat: s.lat, lon: s.lon });
    onSelect({ text: s.description, placeId: s.placeId, lat: s.lat, lon: s.lon });
    selectedRef.current = true;
    setOpen(false);
    setSuggestions([]);
  }, [onChange, onSelect]);

  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      {label && <div style={{ fontSize: 11, color: '#64748b', marginBottom: 5, fontWeight: 600 }}>{label}</div>}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 12, fontSize: 16, zIndex: 1 }}>{icon}</span>
          <input
            value={value.text}
            onChange={handleChange}
            onBlur={() => setTimeout(() => setOpen(false), 180)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder={`Search any area, locality, city...`}
            style={{
              width: '100%', background: '#0a0e1a',
              border: `1px solid ${error ? '#ef4444' : value.lat ? '#22c55e' : '#1e2d45'}`,
              borderRadius: 10, padding: '11px 40px 11px 38px',
              color: '#f1f5f9', fontSize: 13, outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
          />
          {loading && (
            <span style={{ position: 'absolute', right: 12, fontSize: 12, color: '#475569' }}>⏳</span>
          )}
          {value.lat && !loading && (
            <span style={{ position: 'absolute', right: 12, fontSize: 14, color: '#22c55e' }}>✓</span>
          )}
        </div>

        {error && (
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠️ {error}</div>
        )}

        {open && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
            background: '#111827', border: '1px solid #1e2d45', borderRadius: 10,
            marginTop: 4, overflow: 'hidden', boxShadow: '0 12px 32px #00000088',
          }}>
            {suggestions.map((s, i) => (
              <div
                key={i}
                onMouseDown={() => handleSelect(s)}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: i < suggestions.length - 1 ? '1px solid #1a2235' : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#1a2235'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ color: '#3b82f6', fontSize: 14, marginTop: 1, flexShrink: 0 }}>📍</span>
                  <div>
                    <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>
                      {s.structured?.main || s.description}
                    </div>
                    {s.structured?.secondary && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                        {s.structured.secondary}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Segment / Mode Pills ──────────────────────────────────────────────────────
function ModePill({ mode }) {
  const colors = { ROAD: '#22c55e', TRAIN: '#60a5fa', AIR: '#a78bfa' };
  const c = colors[mode] || '#94a3b8';
  return (
    <span style={{ background: c + '22', color: c, border: `1px solid ${c}44`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
      {modeIcon(mode)} {mode}
    </span>
  );
}

// ── Traffic color badge ───────────────────────────────────────────────────────
function TrafficBadge({ color }) {
  const map = { green: { bg: '#052e16', text: '#4ade80', label: 'Low Traffic' }, orange: { bg: '#422006', text: '#fb923c', label: 'Moderate' }, red: { bg: '#450a0a', text: '#f87171', label: 'Heavy Traffic' } };
  const s = map[color] || map.green;
  return (
    <span style={{ background: s.bg, color: s.text, border: `1px solid ${s.text}44`, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
      ● {s.label}
    </span>
  );
}

// ── Step-by-step directions ───────────────────────────────────────────────────
function RouteSteps({ steps }) {
  if (!steps?.length) return null;
  const modeColors = { ROAD: '#22c55e', TRAIN: '#60a5fa', AIR: '#a78bfa' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 10 }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: modeColors[step.mode] + '22',
              border: `2px solid ${modeColors[step.mode]}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: modeColors[step.mode], fontWeight: 700,
            }}>
              {step.step}
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 2, height: 24, background: '#1e2d45', margin: '2px 0' }} />
            )}
          </div>
          <div style={{ paddingBottom: i < steps.length - 1 ? 8 : 0, flex: 1 }}>
            <div style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 600 }}>{step.instruction}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: modeColors[step.mode] }}>{modeIcon(step.mode)} {step.mode}</span>
              {step.distKm > 0 && <span style={{ fontSize: 10, color: '#64748b' }}>{step.distKm} km</span>}
              {step.durationMin > 0 && <span style={{ fontSize: 10, color: '#64748b' }}>{step.durationMin} min</span>}
              {step.trainNo && <span style={{ fontSize: 10, color: '#60a5fa' }}>Train #{step.trainNo}</span>}
              {step.departure && <span style={{ fontSize: 10, color: '#a78bfa' }}>Dep: {step.departure} → Arr: {step.arrival}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Route Card ────────────────────────────────────────────────────────────────
function RouteCard({ route, selected, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      onClick={() => onSelect(route.id)}
      style={{
        background: selected ? '#0c1a3a' : '#111827',
        border: `1px solid ${route.recommended ? '#3b82f6' : selected ? '#3b82f6' : '#1e2d45'}`,
        borderRadius: 12, padding: 14, cursor: 'pointer',
        transition: 'all 0.2s', position: 'relative',
      }}
    >
      {route.recommended && (
        <div style={{
          position: 'absolute', top: -10, right: 12,
          background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
          color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
        }}>⭐ AI BEST ROUTE</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>{route.label}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            {route.modes.map(m => <ModePill key={m} mode={m} />)}
            <TrafficBadge color={route.congestionColor} />
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>{fmtEta(route.eta)}</div>
          <div style={{ fontSize: 11, color: riskColor(route.risk) }}>Risk {route.risk}%</div>
          {route.distKm > 0 && <div style={{ fontSize: 10, color: '#64748b' }}>{route.distKm} km</div>}
        </div>
      </div>

      {/* Risk bar */}
      <div style={{ background: '#1e2d45', borderRadius: 999, height: 4, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${route.risk}%`, background: riskColor(route.risk), borderRadius: 999, transition: 'width 0.6s' }} />
      </div>

      {/* Reasons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
        {route.reasons?.slice(0, 2).map((r, i) => (
          <div key={i} style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 5 }}>
            <span style={{ color: '#334155' }}>•</span>{r}
          </div>
        ))}
      </div>

      {/* Train info banner */}
      {route.trainInfo && (
        <div style={{ background: '#0c1a3a', border: '1px solid #1e40af', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>🚂 {route.trainInfo.trainName} #{route.trainInfo.trainNo}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            {route.trainInfo.fromStation} → {route.trainInfo.toStation}
          </div>
          <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 2 }}>
            Departs {route.trainInfo.departure} · Arrives {route.trainInfo.arrival} · Buffer: {route.trainInfo.bufferMin} min
          </div>
        </div>
      )}

      {/* Expand steps */}
      {route.segments?.length > 0 && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
          style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 11, cursor: 'pointer', padding: 0, fontWeight: 600 }}
        >
          {expanded ? '▲ Hide steps' : '▼ Show step-by-step directions'}
        </button>
      )}
      {expanded && <RouteSteps steps={route.segments} />}
    </div>
  );
}

// ── Main TripPlanner ──────────────────────────────────────────────────────────
export default function TripPlanner({ onPlanResult, onNavStateChange }) {
  const [from, setFrom]   = useState({ text: '', placeId: null, lat: null, lon: null });
  const [to, setTo]       = useState({ text: '', placeId: null, lat: null, lon: null });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [osrmRoute, setOsrmRoute] = useState(null);
  const [osrmLoading, setOsrmLoading] = useState(false);

  const {
    isNavigating, gpsPosition, gpsError, currentStepIndex,
    liveRoute, isRerouting, distToNextTurn, startNavigation, stopNavigation,
  } = useNavigation(from, to);

  const { fetchLocation, isLoading: geoLoading } = useCurrentLocation();

  function handleUseCurrentLocation() {
    fetchLocation(
      ({ lat, lon, address }) => {
        const locationData = { text: address, placeId: null, lat, lon };
        setFrom(locationData);
        setErrors(e => ({ ...e, from: null }));
        toast.success('Current location set!', { icon: '📍' });
      },
      (msg) => {
        toast.error(msg, { icon: '📍', duration: 5000 });
      }
    );
  }

  // Propagate navigation state up to App so LiveMap can use it
  useEffect(() => {
    onNavStateChange?.({
      gpsPosition, isNavigating, liveRoute,
      currentStepIndex, distToNextTurn, isRerouting, gpsError,
      onStopNavigation: stopNavigation,
    });
  }, [gpsPosition, isNavigating, liveRoute, currentStepIndex, distToNextTurn, isRerouting, gpsError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-draw OSRM route on map whenever both locations are selected
  useEffect(() => {
    let cancelled = false;

    if (!from.lat || !to.lat) {
      setOsrmRoute(null);
      setResult(null);
      // Keep origin pin on map for "Use Current Location" UX
      onPlanResult?.(from.lat ? {
        origin: { lat: from.lat, lng: from.lon, formattedAddress: from.text },
        destination: null,
        directionsData: null,
      } : null);
      return;
    }

    setOsrmLoading(true);
    fetchOSRMRoute(from, to).then(route => {
      if (cancelled) return;
      setOsrmLoading(false);
      setOsrmRoute(route);
      if (route) {
        onPlanResult?.({
          origin: { lat: from.lat, lng: from.lon, formattedAddress: from.text },
          destination: { lat: to.lat, lng: to.lon, formattedAddress: to.text },
          directionsData: [{
            polyline: route.polyline,
            distanceKm: route.distanceKm,
            durationMin: route.durationMin,
            durationTrafficMin: route.durationMin,
          }],
        });
      }
    });

    return () => { cancelled = true; };
  }, [from.lat, from.lon, to.lat, to.lon]);

  function validate() {
    const e = {};
    if (!from.text.trim()) e.from = 'Enter a starting location';
    else if (!from.lat) e.from = 'Please select a location from the suggestions';
    if (!to.text.trim())   e.to   = 'Enter a destination';
    else if (!to.lat)      e.to   = 'Please select a location from the suggestions';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handlePlan() {
    if (!validate()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await planRoute(
        from.text.trim(), to.text.trim(),
        from.placeId, to.placeId,
        { lat: from.lat, lon: from.lon },
        { lat: to.lat, lon: to.lon }
      );
      if (data.error) { toast.error(data.error, { duration: 5000 }); setLoading(false); return; }
      setResult(data);
      setSelectedRoute(data.bestRoute?.id || 'A');
      onPlanResult?.(data);
      toast.success(`Route found: ${data.distKm || '?'} km`, { icon: '🗺️' });
    } catch (e) {
      toast.error('Failed to plan route. Check server connection.');
    }
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Search Card ── */}
      <div className="card">
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🗺️</span> AI Route Planner
          <span style={{ fontSize: 10, color: '#475569', fontWeight: 400, marginLeft: 4 }}>Works for any locality, society, area</span>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>FROM — Starting Location</span>
              <button
                onClick={handleUseCurrentLocation}
                disabled={geoLoading}
                title="Use your current GPS location as the starting point"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: geoLoading ? '#1a2235' : '#0c1a3a',
                  border: '1px solid #1e40af',
                  borderRadius: 6, padding: '3px 10px',
                  color: geoLoading ? '#475569' : '#60a5fa',
                  fontSize: 11, fontWeight: 600, cursor: geoLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                  opacity: geoLoading ? 0.7 : 1,
                }}
                onMouseEnter={e => { if (!geoLoading) e.currentTarget.style.borderColor = '#3b82f6'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e40af'; }}
              >
                {geoLoading
                  ? <><span style={{ fontSize: 10 }}>⏳</span> Fetching location…</>
                  : <><span style={{ fontSize: 12 }}>📍</span> Use Current Location</>
                }
              </button>
            </div>
            <PlaceInput
              label=""
              icon="🟢"
              value={from}
              onChange={setFrom}
              onSelect={v => { setFrom(v); setErrors(e => ({ ...e, from: null })); }}
              error={errors.from}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 2 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a2235', border: '1px solid #1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#475569' }}>→</div>
          </div>

          <PlaceInput
            label="TO — Destination"
            icon="🔴"
            value={to}
            onChange={setTo}
            onSelect={v => { setTo(v); setErrors(e => ({ ...e, to: null })); }}
            error={errors.to}
          />

          <button
            className="btn-primary"
            onClick={handlePlan}
            disabled={loading}
            style={{ opacity: loading ? 0.6 : 1, padding: '11px 24px', fontSize: 13, whiteSpace: 'nowrap', alignSelf: 'flex-end' }}
          >
            {loading ? '⏳ Analyzing...' : '🚀 Find Best Route'}
          </button>
        </div>

        <div style={{ fontSize: 10, color: '#334155', marginTop: 10 }}>
          💡 Type any locality name and select from suggestions for best accuracy
        </div>
      </div>

      {/* ── OSRM quick summary (shown while both selected, before full AI plan) ── */}
      {osrmRoute && !result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card2" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22 }}>📏</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa', marginTop: 4 }}>{osrmRoute.distanceKm} km</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Distance</div>
          </div>
          <div className="card2" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22 }}>⏱️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e', marginTop: 4 }}>{osrmRoute.durationMin} min</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Est. Duration</div>
          </div>
        </div>
      )}
      {osrmLoading && !osrmRoute && from.lat && to.lat && (
        <div className="card2" style={{ textAlign: 'center', color: '#64748b', fontSize: 13 }}>
          ⏳ Calculating route…
        </div>
      )}

      {/* ── Start / Stop Navigation button ── */}
      {osrmRoute && !result && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {!isNavigating ? (
            <button
              onClick={startNavigation}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none', borderRadius: 10, padding: '11px 28px',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 0 18px #22c55e44', transition: 'opacity 0.2s',
                width: '100%', justifyContent: 'center',
              }}
            >
              <Navigation2 size={16} />
              Start Navigation
            </button>
          ) : (
            <button
              onClick={stopNavigation}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#450a0a', border: '1px solid #991b1b',
                borderRadius: 10, padding: '11px 28px',
                color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                width: '100%', justifyContent: 'center',
              }}
            >
              <Square size={14} fill="#f87171" />
              Stop Navigation
            </button>
          )}
        </div>
      )}

      {/* ── Navigation Panel (turn-by-turn) ── */}
      {isNavigating && (
        <NavigationPanel
          liveRoute={liveRoute}
          currentStepIndex={currentStepIndex}
          gpsPosition={gpsPosition}
          gpsError={gpsError}
          isRerouting={isRerouting}
          distToNextTurn={distToNextTurn}
          onStop={stopNavigation}
        />
      )}

      {/* ── Results ── */}
      {result && (
        <>
          {/* Distance + instant summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { icon: '📏', label: 'Distance', value: result.distKm ? `${result.distKm} km` : '—', color: '#60a5fa' },
              { icon: weatherIcon(result.weatherData?.condition), label: 'Weather', value: result.weatherData?.condition || '—', color: weatherColor(result.weatherData?.condition) },
              { icon: '🚦', label: 'Traffic', value: `${Math.round((result.trafficData?.congestion || 0) * 100)}%`, color: result.trafficData?.congestion > 0.6 ? '#ef4444' : result.trafficData?.congestion > 0.4 ? '#f59e0b' : '#22c55e' },
              { icon: '🔮', label: 'Forecast', value: result.forecastWorst || 'Clear', color: weatherColor(result.forecastWorst) },
            ].map(s => (
              <div key={s.label} className="card2" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22 }}>{s.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Best route banner */}
          {result.bestRoute && (
            <div style={{
              background: 'linear-gradient(135deg,#0c1a3a,#1e1b4b)',
              border: '1px solid #3b82f6', borderRadius: 12, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ fontSize: 36 }}>🏆</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700, letterSpacing: '0.08em' }}>AI RECOMMENDED BEST ROUTE</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', marginTop: 2 }}>{result.bestRoute.label}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{result.bestRoute.reasons?.slice(0, 2).join(' · ')}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9' }}>{fmtEta(result.bestRoute.eta)}</div>
                <div style={{ fontSize: 12, color: riskColor(result.bestRoute.risk) }}>Risk: {result.bestRoute.risk}%</div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
                  {result.bestRoute.modes.map(m => <ModePill key={m} mode={m} />)}
                </div>
              </div>
            </div>
          )}

          {/* All route cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {result.routes?.map(route => (
              <RouteCard key={route.id} route={route} selected={selectedRoute === route.id} onSelect={setSelectedRoute} />
            ))}
          </div>

          {/* Next hours traffic prediction */}
          {result.nextHoursPrediction?.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>🧠 Traffic Prediction (Next 3 Hours)</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {result.nextHoursPrediction.map((p, i) => {
                  const pct = Math.round(p.predicted * 100);
                  const col = pct > 60 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#22c55e';
                  return (
                    <div key={i} className="card2" style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: col }}>{pct}%</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{p.hour}:00</div>
                      <div style={{ fontSize: 9, color: '#334155' }}>{p.source}</div>
                      <div style={{ background: '#1e2d45', borderRadius: 999, height: 3, marginTop: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 999 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alerts */}
          {result.alerts?.length > 0 && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>⚡ Route Alerts</div>
              {result.alerts.map((a, i) => (
                <div key={i} className={a.type === 'danger' ? 'alert-danger' : a.type === 'warning' ? 'alert-warning' : 'alert-info'}
                  style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0 }}>{a.type === 'danger' ? '🚨' : a.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                  <span style={{ fontSize: 12 }}>{a.msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Insights */}
          {result.insights?.length > 0 && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>🧠 Predictive Insights</div>
              {result.insights.map((ins, i) => (
                <div key={i} className="card2" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
                  <span style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{ins}</span>
                </div>
              ))}
            </div>
          )}

          {/* Weather forecast */}
          {result.weatherData?.forecast?.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>🌤️ Weather Forecast</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                {result.weatherData.forecast.map((f, i) => (
                  <div key={i} className="card2" style={{ flex: '0 0 auto', textAlign: 'center', minWidth: 76 }}>
                    <div style={{ fontSize: 20 }}>{weatherIcon(f.condition)}</div>
                    <div style={{ fontSize: 10, color: weatherColor(f.condition), fontWeight: 600, marginTop: 3 }}>{f.condition}</div>
                    <div style={{ fontSize: 12, color: '#f1f5f9', marginTop: 2 }}>{f.temp}°C</div>
                    {f.pop > 0 && <div style={{ fontSize: 10, color: '#60a5fa' }}>💧{f.pop}%</div>}
                    <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>{f.time?.slice(11, 16)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
