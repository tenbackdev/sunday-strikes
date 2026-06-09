import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { computeStats } from '../lib/parseGame'
import {
  ComposedChart, BarChart,
  Area, Line, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const TIME_FILTERS = [
  { key: 'all',  label: 'All Time' },
  { key: 'year', label: 'This Year' },
  { key: '3mo',  label: '3 Months' },
  { key: '30d',  label: '30 Days' },
]

const AMBER = '#BE7C2A'
const FIXED_H = 56

function getChartColors() {
  const s = getComputedStyle(document.documentElement)
  return {
    accent: s.getPropertyValue('--accent').trim() || '#CE1B0E',
    sub:    s.getPropertyValue('--sub').trim()    || '#9E8B6E',
    border: s.getPropertyValue('--border').trim() || '#DECCA2',
    text:   s.getPropertyValue('--text').trim()   || '#2C1810',
  }
}

function toLocalDateStr(isoStr) {
  const d = new Date(isoStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fmtDateLong(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

function RangeBandTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{fmtDateLong(d.date)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        <span style={{ color: 'var(--sub)' }}>High <span style={{ color: 'var(--text)', fontWeight: 700 }}>{d.high}</span></span>
        <span style={{ color: 'var(--sub)' }}>Avg  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{d.avg}</span></span>
        <span style={{ color: 'var(--sub)' }}>Low  <span style={{ color: 'var(--text)', fontWeight: 700 }}>{d.low}</span></span>
      </div>
    </div>
  )
}

function RollingTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const score   = payload.find(p => p.dataKey === 'score')?.value
  const rolling = payload.find(p => p.dataKey === 'rolling')?.value
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--sub)', fontSize: 10, marginBottom: 4 }}>GAME {label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        <span style={{ color: 'var(--sub)' }}>Score <span style={{ color: 'var(--text)', fontWeight: 700 }}>{score}</span></span>
        <span style={{ color: 'var(--sub)' }}>10-game avg <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{rolling}</span></span>
      </div>
    </div>
  )
}

function DistributionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const count = payload[0]?.value
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)', fontWeight: 700 }}>{count} {count === 1 ? 'game' : 'games'}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--sub)', fontSize: 10 }}>{label === '300' ? 'Perfect game' : `${label}–${Number(label) + 19}`}</div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)', paddingTop: 14, paddingBottom: 10, overflow: 'hidden' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sub)', marginBottom: 10, paddingLeft: 16 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export default function Trends({ session, theme }) {
  const [timeFilter, setTimeFilter] = useState(() => localStorage.getItem('ss_trends_time_filter') ?? 'all')
  const [games, setGames]           = useState([])
  const [isLoading, setIsLoading]   = useState(true)

  // Re-derive colors when theme toggles so SVG props pick up new values
  const colors = useMemo(() => getChartColors(), [theme])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const now = new Date()
      let q = supabase.from('games').select('*').eq('user_id', session.user.id).order('played_at', { ascending: false })
      if (timeFilter === 'year') q = q.gte('played_at', new Date(now.getFullYear(), 0, 1).toISOString())
      else if (timeFilter === '3mo') q = q.gte('played_at', new Date(now - 90 * 86400000).toISOString())
      else if (timeFilter === '30d') q = q.gte('played_at', new Date(now - 30 * 86400000).toISOString())
      const { data } = await q
      if (!cancelled) {
        setGames(data ?? [])
        setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [timeFilter, session.user.id])

  function changeFilter(key) {
    setTimeFilter(key)
    localStorage.setItem('ss_trends_time_filter', key)
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const ribbonStats = useMemo(() => {
    if (!games.length) return null
    const scores = games.map(g => g.total_score ?? 0)
    return {
      total:         games.length,
      avgScore:      Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      bestScore:     Math.max(...scores),
      perfectCount:  games.filter(g => g.total_score === 300).length,
      totalStrikes:  games.reduce((s, g) => s + computeStats(g.frames ?? []).strikes, 0),
    }
  }, [games])

  // Group by calendar day, sorted oldest → newest
  const byDay = useMemo(() => {
    const map = {}
    for (const g of games) {
      const day = toLocalDateStr(g.played_at)
      if (!map[day]) map[day] = []
      map[day].push(g.total_score ?? 0)
    }
    return Object.entries(map)
      .map(([date, scores]) => {
        const high = Math.max(...scores)
        const low  = Math.min(...scores)
        return { date, high, low, avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), bandWidth: high - low }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [games])

  // Rolling 10-game average over games sorted oldest → newest
  const rollingData = useMemo(() => {
    const N = 10
    const sorted = [...games].reverse()
    return sorted.map((g, i) => {
      const window = sorted.slice(Math.max(0, i - N + 1), i + 1)
      return {
        index:   i + 1,
        score:   g.total_score ?? 0,
        rolling: Math.round(window.reduce((s, x) => s + (x.total_score ?? 0), 0) / window.length),
      }
    })
  }, [games])

  // 20-point score distribution buckets; score of 300 gets its own dedicated bucket
  const distribution = useMemo(() => {
    if (!games.length) return []
    const scores   = games.map(g => g.total_score ?? 0)
    const regular  = scores.filter(s => s < 300)
    const perfects = scores.filter(s => s === 300).length
    const bucket   = s => Math.floor(s / 20) * 20

    const result = []
    if (regular.length) {
      const minB = bucket(Math.min(...regular))
      const maxB = bucket(Math.max(...regular))
      for (let b = minB; b <= maxB; b += 20) {
        result.push({ label: String(b), count: regular.filter(s => bucket(s) === b).length, isPerfect: false })
      }
    }
    if (perfects > 0) result.push({ label: '300', count: perfects, isPerfect: true })

    const peak = Math.max(...result.map(r => r.count))
    return result.map(r => ({ ...r, isMax: r.count === peak }))
  }, [games])

  const hasGames        = games.length > 0
  const bandTickInterval = byDay.length > 20 ? Math.ceil(byDay.length / 10) - 1 : 'preserveStartEnd'

  return (
    <div>
      {/* ── Sticky filter header ── */}
      <div style={{ position: 'sticky', top: FIXED_H, zIndex: 18, background: 'var(--bg)', paddingTop: 8, paddingBottom: 12 }}>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1 rounded-xl p-1" style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>
            {TIME_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => changeFilter(f.key)}
                className="flex-1 rounded-lg py-1.5 text-xs font-medium transition-all"
                style={timeFilter === f.key ? {
                  background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                  color: 'var(--accent)',
                  border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                } : { color: 'var(--sub)', border: '1px solid transparent' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ribbon stats */}
        {!isLoading && ribbonStats && (
          <div style={{ marginTop: 12, display: 'flex', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card)', boxShadow: '0 1px 2px rgba(60,40,15,0.05)' }}>
            {[
              { k: 'GAMES',   v: ribbonStats.total,        badge: null },
              { k: 'AVG',     v: ribbonStats.avgScore,     badge: null },
              { k: 'BEST',    v: ribbonStats.bestScore,    badge: ribbonStats.perfectCount > 1 ? ribbonStats.perfectCount : null },
              { k: 'STRIKES', v: ribbonStats.totalStrikes, badge: null },
            ].map((r, i) => (
              <div key={r.k} style={{ flex: 1, padding: '10px 0 11px', textAlign: 'center', borderLeft: i ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, lineHeight: 1 }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', color: r.k === 'BEST' && r.v === 300 ? AMBER : 'var(--text)' }}>
                    {r.v}
                  </span>
                  {r.badge && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 700, color: AMBER, background: 'rgba(190,124,42,0.14)', border: '1px solid rgba(190,124,42,0.32)', borderRadius: 999, padding: '1px 5px 1px 4px' }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" /></svg>
                      {r.badge}
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sub)', marginTop: 4 }}>{r.k}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex justify-center py-16 text-sm" style={{ color: 'var(--sub)' }}>Loading…</div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && !hasGames && (
        <div className="flex flex-col items-center justify-center rounded-2xl py-16 mt-6" style={{ border: '2px dashed var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--sub)' }}>No games in this period</p>
          <p className="mt-1 text-xs" style={{ color: 'color-mix(in srgb, var(--sub) 60%, transparent)' }}>Try a wider time range</p>
        </div>
      )}

      {/* ── Charts ── */}
      {!isLoading && hasGames && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>

          {/* Chart A — Score Range Band */}
          <ChartCard title="SCORE RANGE — HIGH / AVG / LOW PER SESSION">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={byDay} margin={{ left: -10, right: 20, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  interval={bandTickInterval}
                  padding={{ left: 12, right: 12 }}
                  tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[dataMin => Math.max(0, dataMin - 10), 300]}
                  tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<RangeBandTooltip />} />
                {/* Transparent baseline anchors the band at 'low' */}
                <Area type="monotone" dataKey="low"       stackId="band" fill="transparent"   fillOpacity={1} stroke="none" isAnimationActive={false} />
                {/* Visible band stretches from low up to high */}
                <Area type="monotone" dataKey="bandWidth" stackId="band" fill={colors.accent} fillOpacity={0.14} stroke="none" isAnimationActive={false} />
                {/* Boundary lines — dashed, muted */}
                <Line type="monotone" dataKey="high" stroke={colors.sub} strokeWidth={1}   strokeDasharray="4 2" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="low"  stroke={colors.sub} strokeWidth={1}   strokeDasharray="4 2" dot={false} isAnimationActive={false} />
                {/* Average — prominent */}
                <Line type="monotone" dataKey="avg"  stroke={colors.accent} strokeWidth={2.5} dot={byDay.length === 1 ? { fill: colors.accent, r: 4, strokeWidth: 0 } : false} activeDot={{ r: 4, fill: colors.accent, strokeWidth: 0 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Charts B + C — side by side on sm+, stacked on mobile */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

            {/* Chart B — Rolling 10-Game Average */}
            <ChartCard title="ROLLING 10-GAME AVERAGE">
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={rollingData} margin={{ left: -10, right: 20, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
                  <XAxis
                    dataKey="index"
                    padding={{ left: 12, right: 12 }}
                    tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[dataMin => Math.max(0, dataMin - 10), 300]}
                    tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<RollingTooltip />} />
                  {/* Individual game scores — faint dots */}
                  <Line type="monotone" dataKey="score"   stroke="none" dot={{ fill: colors.sub, r: 2.5, strokeWidth: 0, fillOpacity: 0.4 }} activeDot={false} isAnimationActive={false} />
                  {/* 10-game rolling average — bold line */}
                  <Line type="monotone" dataKey="rolling" stroke={colors.accent} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: colors.accent, strokeWidth: 0 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Chart C — Score Distribution */}
            <ChartCard title="SCORE DISTRIBUTION">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={distribution} margin={{ left: -10, right: 20, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fill: colors.sub }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip content={<DistributionTooltip />} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                    {distribution.map((entry, i) => (
                      <Cell key={i} fill={colors.accent} fillOpacity={entry.isMax ? 1 : 0.35} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

          </div>
        </div>
      )}
    </div>
  )
}
