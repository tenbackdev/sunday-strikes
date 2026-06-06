import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { computeStats, computeLeaveMetrics } from '../lib/parseGame'
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

const STAT_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'strikes',  label: 'Strikes' },
  { key: 'spares',   label: 'Spares' },
  { key: 'pins',     label: 'Pins' },
]

const AMBER = '#BE7C2A'
const FIXED_H = 56

// Fixed bucket definitions — always 12 buckets regardless of data
const DIST_BUCKETS = [
  { label: '< 100', test: s => s < 100, isPerfect: false },
  ...Array.from({ length: 10 }, (_, i) => {
    const lo = 100 + i * 20
    return { label: String(lo), test: s => s >= lo && s < lo + 20, isPerfect: false }
  }),
  { label: '300', test: s => s === 300, isPerfect: true },
]

function getChartColors() {
  const s = getComputedStyle(document.documentElement)
  return {
    accent: s.getPropertyValue('--accent').trim() || '#CE1B0E',
    sub:    s.getPropertyValue('--sub').trim()    || '#9E8B6E',
    border: s.getPropertyValue('--border').trim() || '#DECCA2',
    text:   s.getPropertyValue('--text').trim()   || '#2C1810',
    third:  '#4A7FA5',
  }
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
      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--sub)', fontSize: 10 }}>
        {label === '300' ? 'Perfect game' : label === '< 100' ? 'Under 100' : `${label}–${Number(label) + 19}`}
      </div>
    </div>
  )
}

function CountTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const count = payload[0]?.value
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)', fontWeight: 700 }}>{count} {count === 1 ? 'game' : 'games'}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--sub)', fontSize: 10 }}>{label} strikes</div>
    </div>
  )
}

function FirstBallTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const count = payload[0]?.value
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)', fontWeight: 700 }}>{count} {count === 1 ? 'frame' : 'frames'}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--sub)', fontSize: 10 }}>{label} pins on first ball</div>
    </div>
  )
}

function countRacks(frames) {
  let racks = 0
  for (const frame of frames) {
    if (frame.frame !== 10) { racks++; continue }
    const [b1, b2] = frame.balls
    racks++
    if (b1 === 'X') {
      racks++
      if (b2 === 'X') racks++
    } else if (b2 === '/') {
      racks++
    }
  }
  return racks
}

function extractStreaks(frames) {
  const isStrike = []
  for (const frame of frames) {
    if (frame.frame !== 10) {
      isStrike.push(frame.balls[0] === 'X')
    } else {
      const [b1, b2, b3] = frame.balls
      isStrike.push(b1 === 'X')
      if (b1 === 'X') {
        isStrike.push(b2 === 'X')
        if (b2 === 'X') isStrike.push(b3 === 'X')
      }
    }
  }
  const streaks = []
  let run = 0
  for (const s of isStrike) {
    if (s) { run++ }
    else { if (run > 0) streaks.push(run); run = 0 }
  }
  if (run > 0) streaks.push(run)
  return streaks
}

const STREAK_NAMES = ['', 'Single', 'Double', 'Turkey', '4-Bagger', '5-Bagger', '6-Bagger', '7-Bagger', '8-Bagger', '9-Bagger', '10-Bagger', '11-Bagger', 'Perfect (12)']

function StrikeRangeBandTooltip({ active, payload }) {
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

function StreakTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const count = payload[0]?.value
  const idx = Number(label)
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)', fontWeight: 700 }}>{count} {count === 1 ? 'time' : 'times'}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--sub)', fontSize: 10 }}>{STREAK_NAMES[idx] ?? `${idx}-Bagger`}</div>
    </div>
  )
}

function RunTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const count = payload[0]?.value
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)', fontWeight: 700 }}>{count} {count === 1 ? 'game' : 'games'}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--sub)', fontSize: 10 }}>
        {label === '0' ? 'no opening strike' : label === '12' ? 'perfect game opener' : `opened with ${label} in a row`}
      </div>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sub)' }}>{label}</span>
    </div>
  )
}

function LeaveComboTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const count    = payload.find(p => p.dataKey === 'count')?.value
  const convRate = payload.find(p => p.dataKey === 'convRate')?.value
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text)', fontSize: 10, marginBottom: 4 }}>{label} PIN{label === '1' ? '' : 'S'} LEFT</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        <span style={{ color: 'var(--sub)' }}>Attempts <span style={{ color: 'var(--text)', fontWeight: 700 }}>{count}</span></span>
        {convRate != null && <span style={{ color: 'var(--sub)' }}>Converted <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{convRate}%</span></span>}
        {convRate == null && <span style={{ color: 'var(--sub)' }}>Converted <span style={{ color: 'var(--sub)', fontWeight: 700 }}>—</span></span>}
      </div>
    </div>
  )
}

function RollingConvTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const overall   = payload.find(p => p.dataKey === 'overall')?.value
  const singlePin = payload.find(p => p.dataKey === 'singlePin')?.value
  const multiPin  = payload.find(p => p.dataKey === 'multiPin')?.value
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--sub)', fontSize: 10, marginBottom: 4 }}>GAME {label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        {overall   != null && <span style={{ color: 'var(--sub)' }}>Overall   <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{overall}%</span></span>}
        {singlePin != null && <span style={{ color: 'var(--sub)' }}>1-pin     <span style={{ color: 'var(--text)', fontWeight: 700 }}>{singlePin}%</span></span>}
        {multiPin  != null && <span style={{ color: 'var(--sub)' }}>Multi-pin <span style={{ color: '#4A7FA5', fontWeight: 700 }}>{multiPin}%</span></span>}
      </div>
    </div>
  )
}

function RollingSplitTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const rate         = payload.find(p => p.dataKey === 'splitConvRate')?.value
  const windowSplits = payload.find(p => p.dataKey === 'windowSplits')?.value
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--sub)', fontSize: 10, marginBottom: 4 }}>GAME {label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        {rate != null
          ? <span style={{ color: 'var(--sub)' }}>Split conv <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{rate}%</span></span>
          : <span style={{ color: 'var(--sub)' }}>No splits in window</span>}
        {windowSplits > 0 && <span style={{ color: 'var(--sub)' }}>Splits (window) <span style={{ color: 'var(--text)', fontWeight: 700 }}>{windowSplits}</span></span>}
      </div>
    </div>
  )
}


function ChartCard({ title, titleRight, titleBelow, children }) {
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

function RibbonStat({ label, value, amber }) {
  return (
    <div style={{ flex: 1, padding: '10px 0 11px', textAlign: 'center' }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', color: amber ? AMBER : 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sub)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function Ribbon({ stats }) {
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl py-16 mt-6" style={{ border: '2px dashed var(--border)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--sub)' }}>No games in this period</p>
      <p className="mt-1 text-xs" style={{ color: 'color-mix(in srgb, var(--sub) 60%, transparent)' }}>Try a wider time range</p>
    </div>
  )
}

export default function Stats({ session, theme }) {
  const [timeFilter, setTimeFilter] = useState(() => localStorage.getItem('ss_stats_time_filter') ?? localStorage.getItem('ss_trends_time_filter') ?? 'all')
  const [statsTab,   setStatsTab]   = useState('overview')
  const [games, setGames]           = useState([])
  const [isLoading, setIsLoading]   = useState(true)
  const [streakMode, setStreakMode]  = useState('inclusive')

  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function changeTimeFilter(key) {
    setTimeFilter(key)
    localStorage.setItem('ss_stats_time_filter', key)
  }

  // ── Overview derived data ─────────────────────────────────────────────────────

  const overviewRibbon = useMemo(() => {
    if (!games.length) return null
    const scores = games.map(g => g.total_score ?? 0)
    return [
      { label: 'GAMES',   value: games.length },
      { label: 'AVG',     value: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) },
      { label: 'BEST',    value: Math.max(...scores), amber: Math.max(...scores) === 300 },
      { label: 'STRIKES', value: games.reduce((s, g) => s + computeStats(g.frames ?? []).strikes, 0) },
    ]
  }, [games])

  const byDay = useMemo(() => {
    const map = {}
    for (const g of games) {
      const day = g.played_at.slice(0, 10)
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

  // Always 12 fixed buckets — no gaps even if a range has zero games
  const distribution = useMemo(() => {
    if (!games.length) return DIST_BUCKETS.map(b => ({ label: b.label, count: 0, isPerfect: b.isPerfect, isMax: false }))
    const scores = games.map(g => g.total_score ?? 0)
    const result = DIST_BUCKETS.map(b => ({
      label: b.label,
      count: scores.filter(b.test).length,
      isPerfect: b.isPerfect,
    }))
    const peak = Math.max(...result.map(r => r.count))
    return result.map(r => ({ ...r, isMax: peak > 0 && r.count === peak }))
  }, [games])

  // ── Strikes derived data ──────────────────────────────────────────────────────

  const strikesData = useMemo(() => {
    if (!games.length) return null
    const allStats = games.map(g => computeStats(g.frames ?? []))
    const totalRacks = games.reduce((s, g) => s + countRacks(g.frames ?? []), 0)

    const allStreaks = []
    for (let i = 0; i < games.length; i++) {
      allStreaks.push(...extractStreaks(games[i].frames ?? []))
    }

    // Best consecutive strike run spanning game boundaries (chronological order)
    const sorted = [...games].sort((a, b) => a.played_at.localeCompare(b.played_at))
    let bestCrossGameRun = 0
    let crossRun = 0
    for (const g of sorted) {
      for (const frame of g.frames ?? []) {
        if (frame.frame !== 10) {
          if (frame.balls[0] === 'X') { crossRun++; if (crossRun > bestCrossGameRun) bestCrossGameRun = crossRun }
          else crossRun = 0
        } else {
          const [b1, b2, b3] = frame.balls ?? []
          if (b1 === 'X') {
            crossRun++; if (crossRun > bestCrossGameRun) bestCrossGameRun = crossRun
            if (b2 === 'X') {
              crossRun++; if (crossRun > bestCrossGameRun) bestCrossGameRun = crossRun
              if (b3 === 'X') { crossRun++; if (crossRun > bestCrossGameRun) bestCrossGameRun = crossRun }
              else crossRun = 0
            } else crossRun = 0
          } else crossRun = 0
        }
      }
    }

    // 10th frame strikes avg per game (0–3)
    let tenthStrikes = 0
    for (const g of games) {
      const f10 = (g.frames ?? []).find(f => f.frame === 10)
      if (!f10) continue
      const [b1, b2, b3] = f10.balls ?? []
      if (b1 === 'X') {
        tenthStrikes++
        if (b2 === 'X') { tenthStrikes++; if (b3 === 'X') tenthStrikes++ }
      } else if (b2 === '/' && b3 === 'X') {
        tenthStrikes++
      }
    }
    const tenthFrameAvg = (tenthStrikes / games.length).toFixed(2)

    const totalStrikes = allStats.reduce((s, x) => s + x.strikes, 0)
    const strikeRate = totalRacks > 0 ? Math.round((totalStrikes / totalRacks) * 100) : 0

    // Strikes-per-game distribution (0–12 possible)
    const strikeCounts = allStats.map(s => s.strikes)
    const strikeDist = Array.from({ length: 13 }, (_, i) => ({
      label: String(i),
      count: strikeCounts.filter(c => c === i).length,
    }))
    const peakStrikeDist = Math.max(...strikeDist.map(d => d.count))

    // Streak distribution (1–12) — two counting modes
    const countsA = Array(13).fill(0)
    const countsB = Array(13).fill(0)
    for (const len of allStreaks) {
      if (len < 1 || len > 12) continue
      countsB[len]++
      for (let k = 1; k <= len; k++) countsA[k]++
    }
    const streakDist = Array.from({ length: 12 }, (_, i) => ({
      label: String(i + 1),
      countA: countsA[i + 1],
      countB: countsB[i + 1],
    }))

    // Opening run distribution (0–12)
    const runDist = Array.from({ length: 13 }, (_, i) => ({
      label: String(i),
      count: allStats.filter(s => s.initialRun === i).length,
    }))
    const peakRunDist = Math.max(...runDist.map(d => d.count))

    // Strikes per session — high / avg / low by day
    const dayMap = {}
    for (let i = 0; i < games.length; i++) {
      const day = games[i].played_at.slice(0, 10)
      if (!dayMap[day]) dayMap[day] = []
      dayMap[day].push(allStats[i].strikes)
    }
    const strikesByDay = Object.entries(dayMap)
      .map(([date, vals]) => {
        const high = Math.max(...vals)
        const low  = Math.min(...vals)
        return { date, high, low, avg: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)), bandWidth: high - low }
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      ribbon: [
        { label: 'STRIKE %',    value: `${strikeRate}%` },
        { label: 'AVG / GAME',  value: (totalStrikes / games.length).toFixed(1) },
        { label: 'BEST STREAK', value: bestCrossGameRun },
        { label: '10TH FRAME',  value: tenthFrameAvg },
      ],
      strikeDist: strikeDist.map(d => ({ ...d, isMax: peakStrikeDist > 0 && d.count === peakStrikeDist })),
      streakDist,
      runDist: runDist.map(d => ({ ...d, isMax: peakRunDist > 0 && d.count === peakRunDist })),
      strikesByDay,
    }
  }, [games])

  // ── Spares derived data ───────────────────────────────────────────────────────

  const sparesData = useMemo(() => {
    if (!games.length) return null
    const allStats = games.map(g => computeStats(g.frames ?? []))

    // Career first-ball average (pre-pass) — used as proxy for the unthrown fill ball
    // when frame 10's first rack is open
    let fbTotal = 0, fbCount = 0
    for (const g of games) {
      for (const f of g.frames ?? []) {
        if (f.balls?.[0] !== 'X') {
          const p = f.balls?.[0] === '-' ? 0 : parseInt(f.balls?.[0], 10) || 0
          fbTotal += p; fbCount++
        }
      }
    }
    const careerAvgFB = fbCount > 0 ? fbTotal / fbCount : 7

    // Per-game leave metrics (indexed parallel to games[])
    const perGameLeave = games.map(g => computeLeaveMetrics(g.frames ?? [], careerAvgFB))

    // Aggregate leave metrics across all games
    let singleAttempts = 0, singleConv = 0, multiAttempts = 0, multiConv = 0
    const aggrLeave = {}
    for (let i = 1; i <= 9; i++) aggrLeave[i] = { count: 0, converted: 0 }
    for (const lm of perGameLeave) {
      singleAttempts += lm.singleAttempts; singleConv += lm.singleConv
      multiAttempts  += lm.multiAttempts;  multiConv  += lm.multiConv
      for (let i = 1; i <= 9; i++) {
        aggrLeave[i].count     += lm.leaveCounts[i].count
        aggrLeave[i].converted += lm.leaveCounts[i].converted
      }
    }

    const totalSpares = allStats.reduce((s, x) => s + x.spares, 0)
    const totalOpens  = allStats.reduce((s, x) => s + x.opens,  0)
    const totalSplits = allStats.reduce((s, x) => s + x.splits, 0)
    const totalConv   = allStats.reduce((s, x) => s + x.conv,   0)
    const spareOpps   = totalSpares + totalOpens
    const convRate      = spareOpps > 0     ? Math.round((totalSpares / spareOpps)    * 100) : 0
    const splitConvRate = totalSplits > 0   ? Math.round((totalConv   / totalSplits)  * 100) : 0
    const singlePinRate = singleAttempts > 0 ? Math.round((singleConv  / singleAttempts) * 100) : 0
    const multiPinRate  = multiAttempts  > 0 ? Math.round((multiConv   / multiAttempts)  * 100) : 0

    // Chart 1 — Leave distribution + conversion combo (fixed buckets 1–9+)
    const leaveDist = Array.from({ length: 9 }, (_, i) => {
      const key = i + 1
      const { count, converted } = aggrLeave[key]
      return {
        label: key === 9 ? '9+' : String(key),
        count,
        convRate: count > 0 ? Math.round((converted / count) * 100) : null,
      }
    })

    // Chronological order (oldest first) for all time-series charts
    const sorted = [...games].reverse()
    const N = 10

    // Chart 2 — Rolling spare conversion: overall / single-pin / multi-pin
    const rollingConvData = sorted.map((_, i) => {
      const wStart = Math.max(0, i - N + 1)
      let wSp = 0, wOp = 0, wSA = 0, wSC = 0, wMA = 0, wMC = 0
      for (let wi = wStart; wi <= i; wi++) {
        const gi = games.length - 1 - wi
        wSp += allStats[gi].spares; wOp += allStats[gi].opens
        wSA += perGameLeave[gi].singleAttempts; wSC += perGameLeave[gi].singleConv
        wMA += perGameLeave[gi].multiAttempts;  wMC += perGameLeave[gi].multiConv
      }
      const wOpps = wSp + wOp
      return {
        index:     i + 1,
        overall:   wOpps > 0 ? Math.round((wSp / wOpps) * 100) : null,
        singlePin: wSA  > 0  ? Math.round((wSC / wSA)   * 100) : null,
        multiPin:  wMA  > 0  ? Math.round((wMC / wMA)   * 100) : null,
      }
    })

    // Chart 3 — Rolling split conversion rate + per-window split count
    const hasSplits = totalSplits > 0
    const rollingSplitData = sorted.map((_, i) => {
      const wStart = Math.max(0, i - N + 1)
      let wSplits = 0, wConv = 0
      for (let wi = wStart; wi <= i; wi++) {
        const wgi = games.length - 1 - wi
        wSplits += allStats[wgi].splits; wConv += allStats[wgi].conv
      }
      return {
        index:         i + 1,
        splitConvRate: wSplits > 0 ? Math.round((wConv / wSplits) * 100) : null,
        windowSplits:  wSplits,
      }
    })

    return {
      ribbon: [
        { label: 'CONV RATE',    value: `${convRate}%` },
        { label: 'SINGLE-PIN %', value: `${singlePinRate}%` },
        { label: 'MULTI-PIN %',  value: `${multiPinRate}%` },
        { label: 'SPLIT CONV %', value: `${splitConvRate}%` },
      ],
      leaveDist,
      rollingConvData,
      rollingSplitData,
      hasSplits,
    }
  }, [games])

  // ── Pins derived data ─────────────────────────────────────────────────────────

  const pinsData = useMemo(() => {
    if (!games.length) return null

    let totalFirstBallPins = 0
    let totalFirstBalls = 0
    const firstBallBuckets = { '0–5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10 (X)': 0 }

    for (const g of games) {
      const frames = g.frames ?? []
      for (let i = 0; i < Math.min(frames.length, 9); i++) {
        const f = frames[i]
        const ball1 = f[0]
        const pins = ball1 === 'X' ? 10 : ball1 === '-' ? 0 : parseInt(ball1, 10)
        if (!isNaN(pins)) {
          totalFirstBallPins += pins
          totalFirstBalls++
          if (pins === 10) firstBallBuckets['10 (X)']++
          else if (pins === 9) firstBallBuckets['9']++
          else if (pins === 8) firstBallBuckets['8']++
          else if (pins === 7) firstBallBuckets['7']++
          else if (pins === 6) firstBallBuckets['6']++
          else firstBallBuckets['0–5']++
        }
      }
    }

    const totalPins  = games.reduce((s, g) => s + (g.total_score ?? 0), 0)
    const firstBallAvg = totalFirstBalls > 0 ? (totalFirstBallPins / totalFirstBalls).toFixed(1) : '0'

    const firstBallDist = Object.entries(firstBallBuckets).map(([label, count]) => ({ label, count }))
    const peakFB = Math.max(...firstBallDist.map(d => d.count))

    return {
      ribbon: [
        { label: 'TOTAL PINS', value: totalPins.toLocaleString() },
        { label: 'AVG / GAME', value: games.length ? Math.round(totalPins / games.length) : 0 },
        { label: '1ST BALL AVG', value: firstBallAvg },
      ],
      firstBallDist: firstBallDist.map(d => ({ ...d, isMax: peakFB > 0 && d.count === peakFB })),
    }
  }, [games])

  const hasGames           = games.length > 0
  const bandTickInterval   = byDay.length > 20 ? Math.ceil(byDay.length / 10) - 1 : 'preserveStartEnd'

  return (
    <div style={{ marginTop: -24 }}>
      {/* ── Sticky filter header ── */}
      <div style={{ position: 'sticky', top: FIXED_H, zIndex: 18, background: 'var(--bg)', paddingTop: 8, paddingBottom: 12 }}>
        {/* Time filter — top row */}
        <div className="flex gap-1 rounded-xl p-1 mb-2" style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>
          {TIME_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => changeTimeFilter(f.key)}
              className="flex-1 rounded-lg py-1.5 text-xs font-medium"
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

        {/* Category tabs — bottom row */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>
          {STAT_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setStatsTab(t.key)}
              className="flex-1 rounded-lg py-1.5 text-xs font-medium"
              style={statsTab === t.key ? {
                background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                color: 'var(--accent)',
                border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
              } : { color: 'var(--sub)', border: '1px solid transparent' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex justify-center py-16 text-sm" style={{ color: 'var(--sub)' }}>Loading…</div>
      )}

      {/* ── Overview tab ── */}
      {!isLoading && statsTab === 'overview' && (
        <>
          {!hasGames && <EmptyState />}
          {hasGames && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>

              {/* Ribbon */}
              {overviewRibbon && (
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card)', boxShadow: '0 1px 2px rgba(60,40,15,0.05)' }}>
                  {overviewRibbon.map((r, i) => (
                    <div key={r.label} style={{ flex: 1, padding: '10px 0 11px', textAlign: 'center', borderLeft: i ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', color: r.amber ? AMBER : 'var(--text)', lineHeight: 1 }}>
                        {r.value}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sub)', marginTop: 4 }}>{r.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Chart A — Score Range Band */}
              <ChartCard title="SCORE RANGE — HIGH / AVG / LOW PER SESSION">
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={byDay} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
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
                    <Area type="monotone" dataKey="low"       stackId="band" fill="transparent"   fillOpacity={1} stroke="none" isAnimationActive={false} />
                    <Area type="monotone" dataKey="bandWidth" stackId="band" fill={colors.accent} fillOpacity={0.14} stroke="none" isAnimationActive={false} />
                    <Line type="monotone" dataKey="high" stroke={colors.sub} strokeWidth={1}   strokeDasharray="4 2" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="low"  stroke={colors.sub} strokeWidth={1}   strokeDasharray="4 2" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="avg"  stroke={colors.accent} strokeWidth={2.5} dot={byDay.length === 1 ? { fill: colors.accent, r: 4, strokeWidth: 0 } : false} activeDot={{ r: 4, fill: colors.accent, strokeWidth: 0 }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Charts B + C — side by side on sm+, stacked on mobile */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                {/* Chart B — Rolling 10-Game Average */}
                <ChartCard title="ROLLING 10-GAME AVERAGE">
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={rollingData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
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
                      <Line type="monotone" dataKey="score"   stroke="none" dot={{ fill: colors.sub, r: 2.5, strokeWidth: 0, fillOpacity: 0.4 }} activeDot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="rolling" stroke={colors.accent} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: colors.accent, strokeWidth: 0 }} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Chart C — Score Distribution */}
                <ChartCard title="SCORE DISTRIBUTION">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={distribution} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
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
        </>
      )}

      {/* ── Strikes tab ── */}
      {!isLoading && statsTab === 'strikes' && (
        <>
          {!hasGames && <EmptyState />}
          {hasGames && strikesData && (() => {
            const sTickInterval = strikesData.strikesByDay.length > 20
              ? Math.ceil(strikesData.strikesByDay.length / 10) - 1
              : 'preserveStartEnd'
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>

                <Ribbon stats={strikesData.ribbon} />

                {/* Chart 1 — Strikes Per Session: High / Avg / Low */}
                <ChartCard title="STRIKES PER SESSION — HIGH / AVG / LOW">
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={strikesData.strikesByDay} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={fmtDate}
                        interval={sTickInterval}
                        padding={{ left: 12, right: 12 }}
                        tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 12]}
                        ticks={[0, 3, 6, 9, 12]}
                        tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
                        axisLine={false}
                        tickLine={false}
                        width={24}
                      />
                      <Tooltip content={<StrikeRangeBandTooltip />} />
                      <Area type="monotone" dataKey="low"       stackId="band" fill="transparent"   fillOpacity={1} stroke="none" isAnimationActive={false} />
                      <Area type="monotone" dataKey="bandWidth" stackId="band" fill={colors.accent} fillOpacity={0.14} stroke="none" isAnimationActive={false} />
                      <Line type="monotone" dataKey="high" stroke={colors.sub} strokeWidth={1} strokeDasharray="4 2" dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="low"  stroke={colors.sub} strokeWidth={1} strokeDasharray="4 2" dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="avg"  stroke={colors.accent} strokeWidth={2.5} dot={strikesData.strikesByDay.length === 1 ? { fill: colors.accent, r: 4, strokeWidth: 0 } : false} activeDot={{ r: 4, fill: colors.accent, strokeWidth: 0 }} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Charts 2 + 3 — side by side on sm+ */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                  {/* Chart 2 — Streak Distribution with A/B toggle */}
                  <ChartCard
                    title="STREAK DISTRIBUTION"
                    titleRight={
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[['inclusive', 'CUMULATIVE'], ['exclusive', 'EXACT']].map(([mode, label]) => (
                          <button
                            key={mode}
                            onClick={() => setStreakMode(mode)}
                            style={streakMode === mode ? {
                              padding: '2px 7px', borderRadius: 6,
                              fontSize: 8, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: '0.05em',
                              background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                              color: 'var(--accent)',
                              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                              cursor: 'pointer',
                            } : {
                              padding: '2px 7px', borderRadius: 6,
                              fontSize: 8, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: '0.05em',
                              color: 'var(--sub)', border: '1px solid var(--border)',
                              background: 'transparent', cursor: 'pointer',
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    }
                  >
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={strikesData.streakDist} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
                        <XAxis
                          dataKey="label"
                          interval={0}
                          tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
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
                        <Tooltip content={<StreakTooltip />} />
                        <Bar dataKey={streakMode === 'inclusive' ? 'countA' : 'countB'} radius={[3, 3, 0, 0]} isAnimationActive={false} fill={colors.accent} fillOpacity={0.6} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* Chart 3 — Opening Run Distribution */}
                  <ChartCard title="OPENING RUN — STRIKES FROM FRAME 1">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={strikesData.runDist} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
                        <XAxis
                          dataKey="label"
                          interval={0}
                          tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
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
                        <Tooltip content={<RunTooltip />} />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                          {strikesData.runDist.map((entry, i) => (
                            <Cell key={i} fill={colors.accent} fillOpacity={entry.isMax ? 1 : 0.35} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                </div>

                {/* Chart 4 — Strikes Per Game (count distribution) */}
                <ChartCard title="STRIKES PER GAME">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={strikesData.strikeDist} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
                      <XAxis
                        dataKey="label"
                        interval={0}
                        tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
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
                      <Tooltip content={<CountTooltip />} />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                        {strikesData.strikeDist.map((entry, i) => (
                          <Cell key={i} fill={colors.accent} fillOpacity={entry.isMax ? 1 : 0.35} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

              </div>
            )
          })()}
        </>
      )}

      {/* ── Spares tab ── */}
      {!isLoading && statsTab === 'spares' && (
        <>
          {!hasGames && <EmptyState />}
          {hasGames && sparesData && (() => {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>

                <Ribbon stats={sparesData.ribbon} />

                {/* Chart 1 — Leave Count: Frequency + Conversion combo */}
                <ChartCard title="SPARE ATTEMPTS — LEAVE COUNT &amp; CONVERSION RATE">
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={sparesData.leaveDist} margin={{ left: 0, right: 48, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
                      <XAxis
                        dataKey="label"
                        interval={0}
                        tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        allowDecimals={false}
                        tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 100]}
                        tickFormatter={v => `${v}%`}
                        tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                      />
                      <Tooltip content={<LeaveComboTooltip />} />
                      <Bar yAxisId="left" dataKey="count" fill={colors.accent} fillOpacity={0.45} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                      <Line yAxisId="right" type="natural" dataKey="convRate" stroke={colors.accent} strokeWidth={2} dot={{ r: 3, fill: colors.accent, strokeWidth: 0 }} activeDot={{ r: 4, fill: colors.accent, strokeWidth: 0 }} connectNulls={true} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Chart 2 — Rolling Spare Conversion: Overall / Single-Pin / Multi-Pin */}
                <ChartCard
                  title="ROLLING 10-GAME SPARE CONVERSION"
                  titleBelow={
                    <>
                      <LegendDot color={colors.accent} label="OVERALL" />
                      <LegendDot color={colors.sub}   label="SINGLE PIN" />
                      <LegendDot color={colors.third} label="MULTI-PIN" />
                    </>
                  }
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={sparesData.rollingConvData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
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
                        domain={[0, 100]}
                        tickFormatter={v => `${v}%`}
                        tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                      />
                      <Tooltip content={<RollingConvTooltip />} />
                      <Line type="monotone" dataKey="overall"   stroke={colors.accent} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: colors.accent, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="singlePin" stroke={colors.sub}   strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="multiPin"  stroke={colors.third} strokeWidth={1.5} strokeDasharray="2 4" dot={false} connectNulls={false} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Chart 3 — Rolling Split Conversion Rate + window split count */}
                <ChartCard
                  title="ROLLING 10-GAME SPLIT CONVERSION"
                  titleBelow={
                    <>
                      <LegendDot color={colors.accent} label="CONV %" />
                      <LegendDot color={colors.sub}    label="SPLITS IN WINDOW" />
                    </>
                  }
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={sparesData.rollingSplitData} margin={{ left: 0, right: 48, top: 4, bottom: 0 }}>
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
                        yAxisId="left"
                        domain={[0, 100]}
                        tickFormatter={v => `${v}%`}
                        tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        allowDecimals={false}
                        tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                      />
                      <Tooltip content={<RollingSplitTooltip />} />
                      <Bar yAxisId="right" dataKey="windowSplits" fill={colors.sub} fillOpacity={0.2} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                      {sparesData.hasSplits
                        ? <Line yAxisId="left" type="monotone" dataKey="splitConvRate" stroke={colors.accent} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: colors.accent, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
                        : null
                      }
                    </ComposedChart>
                  </ResponsiveContainer>
                  {!sparesData.hasSplits && (
                    <div style={{ textAlign: 'center', paddingBottom: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--sub)' }}>No splits recorded</div>
                  )}
                </ChartCard>


              </div>
            )
          })()}
        </>
      )}

      {/* ── Pins tab ── */}
      {!isLoading && statsTab === 'pins' && (
        <>
          {!hasGames && <EmptyState />}
          {hasGames && pinsData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>

              <Ribbon stats={pinsData.ribbon} />

              <ChartCard title="FIRST BALL PIN COUNT">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={pinsData.firstBallDist} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
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
                    <Tooltip content={<FirstBallTooltip />} />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {pinsData.firstBallDist.map((entry, i) => (
                        <Cell key={i} fill={colors.accent} fillOpacity={entry.isMax ? 1 : 0.35} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

            </div>
          )}
        </>
      )}
    </div>
  )
}
