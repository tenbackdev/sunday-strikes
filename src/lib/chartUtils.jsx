import { AMBER } from './chartFormat'

export function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sub)' }}>{label}</span>
    </div>
  )
}

export function ChartCard({ title, titleRight, titleBelow, children }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)', paddingTop: 14, paddingBottom: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: titleBelow ? 4 : 10, paddingLeft: 16, paddingRight: 16 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sub)' }}>
          {title}
        </div>
        {titleRight}
      </div>
      {titleBelow && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, paddingLeft: 16, paddingRight: 16 }}>
          {titleBelow}
        </div>
      )}
      {children}
    </div>
  )
}

export function RibbonStat({ label, value, amber }) {
  return (
    <div style={{ flex: 1, padding: '10px 0 11px', textAlign: 'center' }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', color: amber ? AMBER : 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sub)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export function Ribbon({ stats }) {
  return (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card)', boxShadow: '0 1px 2px rgba(60,40,15,0.05)' }}>
      {stats.map((s, i) => (
        <div key={s.label} style={{ flex: 1, borderLeft: i ? '1px solid var(--border)' : 'none' }}>
          <RibbonStat label={s.label} value={s.value} amber={s.amber} />
        </div>
      ))}
    </div>
  )
}
