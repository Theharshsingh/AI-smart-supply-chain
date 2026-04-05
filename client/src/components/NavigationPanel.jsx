import {
  ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight,
  RotateCcw, RotateCw, MapPin, Navigation2, ChevronRight,
  AlertCircle, Wifi, WifiOff,
} from 'lucide-react';

// ── Maneuver icon resolver ────────────────────────────────────────────────────
function ManeuverIcon({ type, modifier, size = 18, color = '#f1f5f9' }) {
  const props = { size, color, strokeWidth: 2.5 };
  const mod = modifier || 'straight';

  if (type === 'depart' || type === 'arrive') return <MapPin {...props} color={type === 'arrive' ? '#22c55e' : '#3b82f6'} />;
  if (type === 'roundabout' || type === 'rotary') return <RotateCcw {...props} />;
  if (type === 'exit roundabout' || type === 'exit rotary') return <RotateCw {...props} />;

  if (mod === 'left' || mod === 'sharp left') return <ArrowLeft {...props} />;
  if (mod === 'right' || mod === 'sharp right') return <ArrowRight {...props} />;
  if (mod === 'slight left') return <ArrowUpLeft {...props} />;
  if (mod === 'slight right') return <ArrowUpRight {...props} />;
  if (mod === 'uturn') return <RotateCcw {...props} />;
  return <ArrowUp {...props} />;
}

// ── Format distance label ─────────────────────────────────────────────────────
function fmtDist(metres) {
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${metres} m`;
}

function fmtDur(seconds) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ── GPS Status Badge ──────────────────────────────────────────────────────────
function GpsBadge({ gpsPosition, gpsError }) {
  if (gpsError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#450a0a', border: '1px solid #991b1b', borderRadius: 6, padding: '3px 8px' }}>
        <WifiOff size={12} color="#f87171" />
        <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>GPS Error</span>
      </div>
    );
  }
  if (!gpsPosition) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#422006', border: '1px solid #92400e', borderRadius: 6, padding: '3px 8px' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s infinite' }} />
        <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>Acquiring GPS…</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#052e16', border: '1px solid #166534', borderRadius: 6, padding: '3px 8px' }}>
      <Wifi size={12} color="#4ade80" />
      <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>GPS Active</span>
      {gpsPosition.accuracy && (
        <span style={{ fontSize: 10, color: '#16a34a' }}>±{gpsPosition.accuracy}m</span>
      )}
    </div>
  );
}

// ── Single step row ───────────────────────────────────────────────────────────
function StepRow({ step, index, isCurrent, isCompleted }) {
  const accent = isCurrent ? '#60a5fa' : isCompleted ? '#334155' : '#475569';
  const bg     = isCurrent ? '#0c1a3a' : 'transparent';
  const border = isCurrent ? '1px solid #1e40af' : '1px solid transparent';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '8px 10px', borderRadius: 8,
      background: bg, border, transition: 'all 0.2s',
      opacity: isCompleted ? 0.4 : 1,
    }}>
      {/* Index circle */}
      <div style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        background: isCurrent ? '#1e40af' : '#1a2235',
        border: `2px solid ${accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ManeuverIcon
          type={step.maneuverType}
          modifier={step.maneuverModifier}
          size={13}
          color={accent}
        />
      </div>

      {/* Instruction + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: isCurrent ? 13 : 12,
          fontWeight: isCurrent ? 700 : 500,
          color: isCurrent ? '#f1f5f9' : '#94a3b8',
          lineHeight: 1.35,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}>
          {step.instruction}
        </div>
        {step.distance > 0 && (
          <div style={{ fontSize: 10, color: isCurrent ? '#60a5fa' : '#334155', marginTop: 2 }}>
            {fmtDist(step.distance)}
            {step.duration > 0 && <span style={{ marginLeft: 8 }}>{fmtDur(step.duration)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main NavigationPanel ──────────────────────────────────────────────────────
export default function NavigationPanel({
  liveRoute,
  currentStepIndex,
  gpsPosition,
  gpsError,
  isRerouting,
  onStop,
}) {
  const steps = liveRoute?.steps || [];
  const currentStep = steps[currentStepIndex];
  const nextStep = steps[currentStepIndex + 1];
  const stepsLeft = steps.length - currentStepIndex - 1;
  const arrived = currentStep?.maneuverType === 'arrive';

  // Remaining distance / duration from current step onwards
  const remaining = steps.slice(currentStepIndex).reduce(
    (acc, s) => ({ dist: acc.dist + s.distance, dur: acc.dur + s.duration }),
    { dist: 0, dur: 0 }
  );

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0c1a3a, #1e1b4b)',
        borderBottom: '1px solid #1e2d45',
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Navigation2 size={16} color="#60a5fa" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Navigation Mode</span>
          {isRerouting && (
            <span style={{ fontSize: 10, color: '#f59e0b', background: '#422006', border: '1px solid #92400e', borderRadius: 4, padding: '1px 6px' }}>
              Rerouting…
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GpsBadge gpsPosition={gpsPosition} gpsError={gpsError} />
          <button
            onClick={onStop}
            style={{
              background: '#450a0a', border: '1px solid #991b1b', borderRadius: 6,
              color: '#f87171', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '3px 10px',
            }}
          >
            ✕ Stop
          </button>
        </div>
      </div>

      {/* ── Arrived banner ── */}
      {arrived && (
        <div style={{ background: '#052e16', borderBottom: '1px solid #166534', padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 24 }}>🏁</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#4ade80', marginTop: 4 }}>You have arrived!</div>
        </div>
      )}

      {/* ── Current step ── */}
      {currentStep && !arrived && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e2d45' }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Current Step
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: '#0c1a3a', border: '2px solid #3b82f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ManeuverIcon
                type={currentStep.maneuverType}
                modifier={currentStep.maneuverModifier}
                size={22}
                color="#60a5fa"
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>
                {currentStep.instruction}
              </div>
              {currentStep.distance > 0 && (
                <div style={{ fontSize: 12, color: '#60a5fa', marginTop: 4, fontWeight: 600 }}>
                  in {fmtDist(currentStep.distance)}
                </div>
              )}
            </div>
          </div>

          {/* Next step preview */}
          {nextStep && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 10px', background: '#1a2235', borderRadius: 6 }}>
              <span style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>Next:</span>
              <ChevronRight size={11} color="#334155" />
              <ManeuverIcon type={nextStep.maneuverType} modifier={nextStep.maneuverModifier} size={12} color="#475569" />
              <span style={{ fontSize: 11, color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nextStep.instruction}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Summary bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #1e2d45' }}>
        {[
          { label: 'Remaining', value: fmtDist(remaining.dist), color: '#f1f5f9' },
          { label: 'ETA', value: fmtDur(remaining.dur), color: '#22c55e' },
          { label: 'Steps left', value: stepsLeft, color: '#60a5fa' },
        ].map(item => (
          <div key={item.label} style={{ padding: '8px 0', textAlign: 'center', borderRight: '1px solid #1e2d45' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* ── Progress bar ── */}
      {steps.length > 0 && (
        <div style={{ height: 3, background: '#1e2d45' }}>
          <div style={{
            height: '100%',
            width: `${((currentStepIndex + 1) / steps.length) * 100}%`,
            background: 'linear-gradient(90deg, #3b82f6, #22c55e)',
            transition: 'width 0.6s ease',
          }} />
        </div>
      )}

      {/* ── Step list ── */}
      <div style={{ maxHeight: 260, overflowY: 'auto', padding: '6px 8px' }}>
        {steps.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, padding: 16 }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>⏳</div>
            Calculating route…
          </div>
        ) : (
          steps.map((step, i) => (
            <StepRow
              key={i}
              step={step}
              index={i}
              isCurrent={i === currentStepIndex}
              isCompleted={i < currentStepIndex}
            />
          ))
        )}
      </div>

      {/* GPS error fallback */}
      {gpsError && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 12px', background: '#450a0a', borderTop: '1px solid #991b1b' }}>
          <AlertCircle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11, color: '#f87171' }}>{gpsError}</span>
        </div>
      )}
    </div>
  );
}
