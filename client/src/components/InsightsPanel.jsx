import { useState, useEffect } from 'react';
import { fetchInsights } from '../api';

export default function InsightsPanel({ shipment }) {
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    if (!shipment) return;
    fetchInsights(shipment.origin, shipment.destination).then(setInsights);
  }, [shipment?.id]);

  const defaultInsights = [
    'Select a shipment to view predictive insights',
  ];

  const items = insights.length ? insights : defaultInsights;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>🧠 Predictive Insights</div>
      {shipment && (
        <div style={{ fontSize: 11, color: '#64748b' }}>
          Based on historical data for {shipment.origin} → {shipment.destination}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((insight, i) => (
          <div key={i} className="card2" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16, marginTop: 1 }}>
              {i === 0 ? '📊' : i === 1 ? '⏰' : i === 2 ? '🌧️' : '🌙'}
            </span>
            <span style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{insight}</span>
          </div>
        ))}
      </div>

      {/* Mini stats */}
      {shipment && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {[
            { label: 'On-Time Rate', value: '72%', color: '#22c55e' },
            { label: 'Avg Delay', value: '1.4h', color: '#f59e0b' },
            { label: 'Risk Index', value: `${shipment.riskScore}%`, color: shipment.riskScore > 60 ? '#ef4444' : '#60a5fa' },
          ].map(stat => (
            <div key={stat.label} className="card2" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
