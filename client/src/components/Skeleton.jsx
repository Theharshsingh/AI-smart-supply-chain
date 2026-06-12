import { motion } from 'framer-motion';

export function CardSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-line" style={{ width: '35%', height: 14, marginBottom: 12 }} />
      <div className="skeleton-line" style={{ width: '60%', height: 28, marginBottom: 6 }} />
      <div className="skeleton-line" style={{ width: '40%', height: 12 }} />
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="skeleton-card" style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div className="skeleton-pulse" style={{ width: 40, height: 40, borderRadius: '50%' }} />
      <div className="skeleton-line" style={{ width: '50%', height: 14 }} />
    </div>
  );
}

export function TableSkeleton({ rows = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="skeleton-pulse" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton-line" style={{ width: '70%', height: 12, marginBottom: 6 }} />
            <div className="skeleton-line" style={{ width: '40%', height: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function KPISkeleton() {
  return (
    <div className="kpi-grid">
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          className="kpi-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="skeleton-pulse" style={{ width: 36, height: 36, borderRadius: 10 }} />
            <div className="skeleton-pulse" style={{ width: 50, height: 20, borderRadius: 10 }} />
          </div>
          <div className="skeleton-line" style={{ width: '50%', height: 28, marginBottom: 4 }} />
          <div className="skeleton-line" style={{ width: '65%', height: 12 }} />
        </motion.div>
      ))}
    </div>
  );
}

export function AlertSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton-card" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12 }}>
          <div className="skeleton-pulse" style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton-line" style={{ width: '80%', height: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}