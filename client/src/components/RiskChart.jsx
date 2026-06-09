import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';
import { riskColor } from '../utils';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a2235', border: '1px solid #1e2d45', borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 11, color: p.color || '#94a3b8', marginTop: 2 }}>
          {p.name}: <b>{Math.round(p.value)}{p.name === 'Risk' ? '%' : ''}</b>
        </div>
      ))}
    </div>
  );
};

// ── Live Risk Radar from env ──────────────────────────────────────────────────
function LiveRiskRadar({ env }) {
  const { weatherData = {}, trafficData = {} } = env;
  const congPct   = Math.round((trafficData.congestion || 0) * 100);
  const windRisk  = Math.min(100, Math.round((weatherData.windSpeed || 0) / 80 * 100));
  const rainRisk  = weatherData.precipitation > 0
    ? Math.min(100, Math.round(weatherData.precipitation / 10 * 100)) : 0;
  const visRisk   = weatherData.visibility != null
    ? Math.max(0, Math.round((10 - weatherData.visibility) / 10 * 100)) : 0;
  const tempRisk  = Math.min(100, Math.round(Math.abs((weatherData.temp || 25) - 25) / 15 * 60));
  const fogRisk   = /fog|mist|haze/i.test(weatherData.condition || '') ? 80 : 0;

  const data = [
    { subject: 'Traffic',    value: congPct },
    { subject: 'Rain',       value: rainRisk },
    { subject: 'Wind',       value: windRisk },
    { subject: 'Visibility', value: visRisk },
    { subject: 'Temp',       value: tempRisk },
    { subject: 'Fog',        value: fogRisk },
  ];

  const maxRisk = Math.max(...data.map(d => d.value));
  const overallColor = maxRisk >= 75 ? '#ef4444' : maxRisk >= 50 ? '#f97316' : maxRisk >= 25 ? '#eab308' : '#22c55e';

  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
        🎯 Live Risk Radar
        <span style={{ fontSize: 10, color: overallColor, background: overallColor + '22', border: `1px solid ${overallColor}44`, borderRadius: 4, padding: '1px 6px', fontWeight: 700, marginLeft: 4 }}>
          {maxRisk}% Peak
        </span>
      </div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 10 }}>Real-time risk factors from live APIs</div>
      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke="#1e2d45" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
          <Radar dataKey="value" stroke={overallColor} fill={overallColor} fillOpacity={0.2} />
        </RadarChart>
      </ResponsiveContainer>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 4 }}>
        {data.map(d => {
          const col = d.value >= 75 ? '#ef4444' : d.value >= 50 ? '#f97316' : d.value >= 25 ? '#eab308' : '#22c55e';
          return (
            <div key={d.subject} style={{ textAlign: 'center', background: '#0a0e1a', border: '1px solid #1e2d45', borderRadius: 6, padding: '5px 0' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: col }}>{d.value}%</div>
              <div style={{ fontSize: 9, color: '#475569' }}>{d.subject}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shipment Risk Bar Chart ───────────────────────────────────────────────────
function ShipmentRiskChart({ shipments }) {
  if (!shipments?.length) return null;
  const data = shipments.map(s => ({ name: s.id, risk: s.riskScore, mode: s.currentMode }));
  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>📊 Fleet Risk Overview</div>
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data} barSize={24}>
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={26} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e2d45' }} />
          <Bar dataKey="risk" name="Risk" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={riskColor(entry.risk)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function RiskChart({ shipments, env }) {
  // If env is passed, show live risk radar; otherwise fleet chart
  if (env) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <LiveRiskRadar env={env} />
        {shipments?.length > 0 && <ShipmentRiskChart shipments={shipments} />}
      </div>
    );
  }
  return <ShipmentRiskChart shipments={shipments} />;
}
