import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { riskColor } from '../utils';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a2235', border: '1px solid #1e2d45', borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{label}</div>
      <div style={{ fontSize: 11, color: riskColor(payload[0].value) }}>Risk: {payload[0].value}%</div>
    </div>
  );
};

export default function RiskChart({ shipments }) {
  const data = shipments.map(s => ({ name: s.id, risk: s.riskScore, mode: s.currentMode }));

  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📊 Fleet Risk Overview</div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} barSize={28}>
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e2d45' }} />
          <Bar dataKey="risk" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={riskColor(entry.risk)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
