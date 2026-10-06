import { useState } from 'react'
import { AMBER } from './chartFormat'

const MONO = "'JetBrains Mono', monospace"
const GROTESK = "'Space Grotesk', sans-serif"

// Shared wrapper for custom Recharts tooltips.
export function TooltipShell({ title, children }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      {title != null && (
        <div style={{ fontFamily: MONO, fontWeight: 700, color: 'var(--text)', fontSize: 10, marginBottom: 4, letterSpacing: '0.04em' }}>{title}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: MONO, fontSize: 11 }}>
        {children}
      </div>
    </div>
  )
}

export function TipRow({ label, value, color = 'var(--text)' }) {
  return (
    <span style={{ color: 'var(--sub)' }}>{label} <span style={{ color, fontWeight: 700 }}>{value}</span></span>
  )
}

// Compact data table in the chart-card idiom. Columns:
//   { key, label, align?, render?(row), sortValue?(row), title? }
// Sortable when a column has sortValue; clicking a row calls onRowClick(row).
export function StatTable({ columns, rows, rowKey, defaultSort, onRowClick, activeRowKey, emptyText = 'No data' }) {
  const [sort, setSort] = useState(defaultSort ?? null)

  const sorted = (() => {
    if (!sort) return rows
    const col = columns.find(c => c.key === sort.key)
    if (!col?.sortValue) return rows
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = col.sortValue(a), bv = col.sortValue(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return av < bv ? -dir : av > bv ? dir : 0
    })
  })()

  function handleSort(col) {
    if (!col.sortValue) return
    setSort(prev => prev?.key === col.key
      ? { key: col.key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      : { key: col.key, dir: 'desc' })
  }

  return (
    <div style={{ overflowX: 'auto', paddingLeft: 8, paddingRight: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11 }}>
        <thead>
          <tr>
            {columns.map(col => {
              const active = sort?.key === col.key
              const align = col.align ?? 'right'
              return (
                <th key={col.key} title={col.title} style={{ textAlign: align, padding: 0, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      className="ss-sort-btn"
                      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      style={{ justifyContent: align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end', color: active ? 'var(--accent)' : 'var(--sub)' }}
                    >
                      {col.label}
                      <span aria-hidden style={{ opacity: active ? 1 : 0.3, fontSize: 8 }}>{active && sort.dir === 'asc' ? '▲' : '▼'}</span>
                    </button>
                  ) : (
                    <span style={{ display: 'block', padding: '6px 8px', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sub)' }}>{col.label}</span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 16, color: 'var(--sub)' }}>{emptyText}</td></tr>
          )}
          {sorted.map(row => {
            const key = rowKey(row)
            const isActive = activeRowKey != null && key === activeRowKey
            return (
              <tr
                key={key}
                className={onRowClick ? 'ss-click-row' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row) } } : undefined}
                style={isActive ? { background: 'color-mix(in srgb, var(--accent) 8%, transparent)' } : undefined}
              >
                {columns.map(col => (
                  <td key={col.key} style={{ textAlign: col.align ?? 'right', padding: '7px 8px', borderBottom: '1px solid color-mix(in srgb, var(--border) 55%, transparent)', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Big-number callout used inside desktop cards.
export function CalloutStat({ label, value, sub, color = 'var(--text)' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: 24, letterSpacing: '-0.03em', lineHeight: 1, color }}>{value}</span>
      <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sub)' }}>{label}</span>
      {sub && <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--sub)' }}>{sub}</span>}
    </div>
  )
}

// Small pill toggle used in chart-card headers.
export function MiniToggle({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className="ss-mini-toggle"
          style={value === key ? {
            background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
            color: 'var(--accent)',
            border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
          } : { color: 'var(--sub)', border: '1px solid var(--border)', background: 'transparent' }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

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
