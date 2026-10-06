import { useState, useMemo } from 'react'
import { useVsMatches } from '../lib/useVsMatches'
import { matchesOil, oilLabel } from '../lib/oilType'
import { groupByOpponent } from '../lib/vsAggregates'
import { computeStats, countRacks } from '../lib/parseGame'
import { getScoreBuckets, bucketAxisProps, normalizeBucketSize, MIN_TREND_SAMPLE, getChartColors } from '../lib/chartFormat'
import { ChartCard, LegendDot } from '../lib/chartUtils'
import {
  ComposedChart, BarChart, ScatterChart,
  Line, Bar, Scatter, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const FIXED_H = 56

const TIME_FILTERS = [
  { key: 'all',  label: 'All Time' },
  { key: 'year', label: 'This Year' },
  { key: '3mo',  label: '3 Months' },
  { key: '30d',  label: '30 Days' },
]

// Closeness-of-game buckets, keyed on |myScore - theirScore| — a bucket can contain
// both wins and losses (a 15-pin margin might be a win or a loss), which is what
// makes the W/L/T stack meaningful here (unlike a signed-margin histogram).
const MARGIN_BUCKETS = [
  { label: 'Tie',   test: m => m === 0 },
  { label: '1–9',   test: m => m >= 1 && m <= 9 },
  { label: '10–19', test: m => m >= 10 && m <= 19 },
  { label: '20–39', test: m => m >= 20 && m <= 39 },
  { label: '40–59', test: m => m >= 40 && m <= 59 },
  { label: '60+',   test: m => m >= 60 },
]

// Shared by the score-range and margin/clutch charts: stacks W/L/T counts per bucket
// and derives a win% (ties included in the denominator, matching the overall record
// calculation used elsewhere in the VS tabs).
function bucketResultCounts(matches, buckets, valueFn) {
  return buckets.map(b => {
    const inBucket = matches.filter(m => b.test(valueFn(m)))
    const w = inBucket.filter(m => m.result === 'W').length
    const l = inBucket.filter(m => m.result === 'L').length
    const t = inBucket.filter(m => m.result === 'T').length
    const total = w + l + t
    return { label: b.label, w, l, t, winPct: total >= MIN_TREND_SAMPLE ? Math.round((w / total) * 100) : null }
  })
}

function ResultStackTooltip({ active, payload, label, lineColor }) {
  if (!active || !payload?.length) return null
  const w = payload.find(p => p.dataKey === 'w')?.value ?? 0
  const l = payload.find(p => p.dataKey === 'l')?.value ?? 0
  const t = payload.find(p => p.dataKey === 't')?.value ?? 0
  const winPct = payload.find(p => p.dataKey === 'winPct')?.value
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text)', fontSize: 10, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        <span style={{ color: 'var(--sub)' }}>W {w} · L {l} · T {t}</span>
        {winPct != null && <span style={{ color: 'var(--sub)' }}>Win% <span style={{ color: lineColor, fontWeight: 700 }}>{winPct}%</span></span>}
      </div>
    </div>
  )
}

// Recharts hands back whichever single point is nearest the cursor, which is misleading
// here since many matches can share the same "my score" (x) but plot as separate/overlapping
// dots. Instead we key off the hovered point's x value and look up every match that shares
// it, so the tooltip always reflects the full, accurate set of results at that score.
// payload can also include the diagonal tie-reference Line (which shares the "y" dataKey) —
// that series' synthetic {x,y} points have no `result`, so skip past it to the real match point.
function ScatterTooltip({ active, payload, points }) {
  if (!active || !payload?.length) return null
  const entry = payload.find(p => p?.payload?.result != null) ?? payload[0]
  const hoveredX = entry?.payload?.x
  if (hoveredX == null) return null
  const matches = (points ?? []).filter(p => p.x === hoveredX).sort((a, b) => b.y - a.y)
  if (matches.length === 0) return null
  const resultColor = r => r === 'W' ? 'var(--win)' : r === 'L' ? 'var(--loss)' : 'var(--sub)'
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: 220 }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>My score: {hoveredX}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--sub)', marginBottom: 3 }}>OPPONENT SCORES</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 168, overflowY: 'auto' }}>
        {matches.map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
            <span style={{ flexShrink: 0, minWidth: 14, textAlign: 'center', fontWeight: 700, borderRadius: 4, fontSize: 9, padding: '1px 3px', color: resultColor(m.result), background: `color-mix(in srgb, ${resultColor(m.result)} 15%, transparent)` }}>
              {m.result}
            </span>
            <span style={{ color: 'var(--text)', fontWeight: 700, minWidth: 24 }}>{m.y}</span>
            <span style={{ color: 'var(--sub)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.oppName}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RollingWinTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const rolling = payload.find(p => p.dataKey === 'rolling')?.value
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--sub)', fontSize: 10, marginBottom: 4 }}>MATCH {label}</div>
      {rolling != null && (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--sub)' }}>10-match win% <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{rolling}%</span></div>
      )}
    </div>
  )
}

function DivergingTooltip({ active, payload, label, oppName }) {
  if (!active || !payload?.length) return null
  const me  = payload.find(p => p.dataKey === 'me')?.value
  const opp = payload.find(p => p.dataKey === 'opp')?.value
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text)', fontSize: 10, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        <span style={{ color: 'var(--sub)' }}>You <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{Math.abs(me ?? 0)}%</span></span>
        <span style={{ color: 'var(--sub)' }}>{oppName} <span style={{ color: 'var(--text)', fontWeight: 700 }}>{opp ?? 0}%</span></span>
      </div>
    </div>
  )
}

function EmptyState({ message, sub }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl py-16 mt-6" style={{ border: '2px dashed var(--border)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--sub)' }}>{message}</p>
      {sub && <p className="mt-1 text-xs" style={{ color: 'color-mix(in srgb, var(--sub) 60%, transparent)' }}>{sub}</p>}
    </div>
  )
}

function AvgScoreCompare({ myAvg, oppAvg, oppName }) {
  return (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card)', boxShadow: '0 1px 2px rgba(60,40,15,0.05)' }}>
      <div style={{ flex: 1, padding: '10px 0 11px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--text)' }}>{myAvg}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sub)', marginTop: 4 }}>YOU — AVG</div>
      </div>
      <div style={{ flex: 1, padding: '10px 0 11px', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--sub)' }}>{oppAvg}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sub)', marginTop: 4 }}>{oppName.toUpperCase()} — AVG</div>
      </div>
    </div>
  )
}

export default function VSStats({ session, oilFilter, theme, bucketSize: bucketSizeProp }) {
  const bucketSize = normalizeBucketSize(bucketSizeProp)
  const { matches, loading } = useVsMatches(session)
  const [timeFilter, setTimeFilter] = useState('all')
  const [opponentFilter, setOpponentFilter] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const colors = useMemo(() => getChartColors(), [theme])

  const timeFiltered = useMemo(() => {
    const now = new Date()
    return matches.filter(m => {
      if (!matchesOil(m.myGame, oilFilter)) return false
      const d = new Date(m.played_at)
      if (timeFilter === 'year') return d.getFullYear() === now.getFullYear()
      if (timeFilter === '3mo') return d >= new Date(now - 90 * 86400000)
      if (timeFilter === '30d') return d >= new Date(now - 30 * 86400000)
      return true
    })
  }, [matches, timeFilter, oilFilter])

  const filtered = useMemo(
    () => timeFiltered.filter(m => !opponentFilter || m.opponentProfile?.id === opponentFilter),
    [timeFiltered, opponentFilter]
  )

  const opponentStats = useMemo(() => groupByOpponent(timeFiltered), [timeFiltered])
  const activeOpponent = opponentFilter ? opponentStats.find(s => s.profile?.id === opponentFilter) : null
  const activeOpponentName = activeOpponent?.profile?.display_name || activeOpponent?.profile?.email || 'Opponent'

  const scoreResultData = useMemo(
    () => bucketResultCounts(filtered, getScoreBuckets(bucketSize), m => m.myGame?.total_score ?? 0),
    [filtered, bucketSize]
  )

  const marginResultData = useMemo(
    () => bucketResultCounts(filtered, MARGIN_BUCKETS, m => Math.abs((m.myGame?.total_score ?? 0) - (m.theirGame?.total_score ?? 0))),
    [filtered]
  )

  const scatterPoints = useMemo(() => filtered.map(m => ({
    x: m.myGame?.total_score ?? 0,
    y: m.theirGame?.total_score ?? 0,
    result: m.result,
    oppName: m.opponentProfile?.display_name || m.opponentProfile?.email || 'Opponent',
    date: m.played_at,
  })), [filtered])

  const rollingWinData = useMemo(() => {
    const N = 10
    const chronological = [...filtered].sort((a, b) => new Date(a.played_at) - new Date(b.played_at))
    return chronological.map((_, i) => {
      const window = chronological.slice(Math.max(0, i - N + 1), i + 1)
      const w = window.filter(x => x.result === 'W').length
      const l = window.filter(x => x.result === 'L').length
      const t = window.filter(x => x.result === 'T').length
      const total = w + l + t
      return {
        index: i + 1,
        rolling: total >= MIN_TREND_SAMPLE ? Math.round((w / total) * 100) : null,
      }
    })
  }, [filtered])

  const h2h = useMemo(() => {
    if (!opponentFilter || filtered.length === 0) return null
    const myFrames  = filtered.flatMap(m => m.myGame?.frames ?? [])
    const oppFrames = filtered.flatMap(m => m.theirGame?.frames ?? [])
    const myStats  = computeStats(myFrames)
    const oppStats = computeStats(oppFrames)
    const myRacks  = filtered.reduce((s, m) => s + countRacks(m.myGame?.frames ?? []), 0)
    const oppRacks = filtered.reduce((s, m) => s + countRacks(m.theirGame?.frames ?? []), 0)
    const myStrikePct  = myRacks  > 0 ? Math.round((myStats.strikes  / myRacks)  * 100) : 0
    const oppStrikePct = oppRacks > 0 ? Math.round((oppStats.strikes / oppRacks) * 100) : 0
    const mySpareOpps  = myStats.spares  + myStats.opens
    const oppSpareOpps = oppStats.spares + oppStats.opens
    const mySparePct  = mySpareOpps  > 0 ? Math.round((myStats.spares  / mySpareOpps)  * 100) : 0
    const oppSparePct = oppSpareOpps > 0 ? Math.round((oppStats.spares / oppSpareOpps) * 100) : 0
    const myAvg  = Math.round(filtered.reduce((s, m) => s + (m.myGame?.total_score ?? 0), 0) / filtered.length)
    const oppAvg = Math.round(filtered.reduce((s, m) => s + (m.theirGame?.total_score ?? 0), 0) / filtered.length)
    return {
      myAvg, oppAvg,
      diverging: [
        { label: 'Strike %',      me: -myStrikePct, opp: oppStrikePct },
        { label: 'Spare Conv %',  me: -mySparePct,  opp: oppSparePct },
      ],
    }
  }, [filtered, opponentFilter])

  const hasMatches = matches.length > 0

  return (
    <div style={{ marginTop: -24 }}>
      {/* Sticky filter header */}
      <div style={{ position: 'sticky', top: FIXED_H, zIndex: 18, background: 'var(--bg)', paddingTop: 8, paddingBottom: 8 }}>
        <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>
          {TIME_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => { setTimeFilter(f.key); setOpponentFilter(null) }}
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

        {opponentStats.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 mt-2">
            <button
              onClick={() => setOpponentFilter(null)}
              className="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all"
              style={!opponentFilter ? { background: 'var(--accent)', color: 'var(--acc-text)' } : {
                background: 'var(--elevated)', color: 'var(--sub)', border: '1px solid var(--border)',
              }}
            >
              All
            </button>
            {opponentStats.map(s => {
              const name = s.profile?.display_name || s.profile?.email || 'Opponent'
              const isActive = opponentFilter === s.profile?.id
              return (
                <button
                  key={s.profile?.id}
                  onClick={() => setOpponentFilter(prev => prev === s.profile?.id ? null : s.profile?.id)}
                  className="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all"
                  style={isActive ? { background: 'var(--accent)', color: 'var(--acc-text)' } : {
                    background: 'var(--elevated)', color: 'var(--sub)', border: '1px solid var(--border)',
                  }}
                >
                  {name.split(' ')[0]}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Body */}
      {loading && (
        <div className="flex justify-center py-16 text-sm" style={{ color: 'var(--sub)' }}>Loading VS stats…</div>
      )}

      {!loading && !hasMatches && (
        <EmptyState message="No VS matches yet" sub="Submit a VS match from My Games to see breakdowns here" />
      )}

      {!loading && hasMatches && filtered.length === 0 && (
        <EmptyState message={`No ${oilFilter && oilFilter !== 'all' ? `${oilLabel(oilFilter)} ` : ''}matches in this range`} />
      )}

      {!loading && hasMatches && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>

          {/* Chart 1 — Score-Range Result Stack + Win% */}
          <ChartCard
            title="RESULT BY SCORE RANGE"
            titleBelow={<>
              <LegendDot color={colors.win}   label="WIN" />
              <LegendDot color={colors.loss}  label="LOSS" />
              <LegendDot color={colors.sub}   label="TIE" />
              <LegendDot color={colors.third} label="WIN%" />
            </>}
          >
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={scoreResultData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="label" interval={0} tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fill: colors.sub }} axisLine={false} tickLine={false} {...bucketAxisProps(bucketSize)} />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }} axisLine={false} tickLine={false} width={30} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<ResultStackTooltip lineColor={colors.third} />} />
                <Bar yAxisId="left" dataKey="w" stackId="result" fill={colors.win}  fillOpacity={0.85} isAnimationActive={false} />
                <Bar yAxisId="left" dataKey="l" stackId="result" fill={colors.loss} fillOpacity={0.85} isAnimationActive={false} />
                <Bar yAxisId="left" dataKey="t" stackId="result" fill={colors.sub}  fillOpacity={0.5}  isAnimationActive={false} radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="winPct" stroke={colors.third} strokeWidth={2.5} dot={{ r: 3, fill: colors.third, strokeWidth: 0 }} activeDot={{ r: 4, fill: colors.third, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Chart 2 — Margin / Clutch combo */}
          <ChartCard
            title="RESULT BY MARGIN — HOW CLOSE ARE YOUR GAMES?"
            titleBelow={<>
              <LegendDot color={colors.win}   label="WIN" />
              <LegendDot color={colors.loss}  label="LOSS" />
              <LegendDot color={colors.sub}   label="TIE" />
              <LegendDot color={colors.third} label="WIN%" />
            </>}
          >
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={marginResultData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="label" interval={0} tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fill: colors.sub }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }} axisLine={false} tickLine={false} width={30} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<ResultStackTooltip lineColor={colors.third} />} />
                <Bar yAxisId="left" dataKey="w" stackId="result" fill={colors.win}  fillOpacity={0.85} isAnimationActive={false} />
                <Bar yAxisId="left" dataKey="l" stackId="result" fill={colors.loss} fillOpacity={0.85} isAnimationActive={false} />
                <Bar yAxisId="left" dataKey="t" stackId="result" fill={colors.sub}  fillOpacity={0.5}  isAnimationActive={false} radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="winPct" stroke={colors.third} strokeWidth={2.5} dot={{ r: 3, fill: colors.third, strokeWidth: 0 }} activeDot={{ r: 4, fill: colors.third, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Chart 3 — Score Scatter / Quadrant */}
          <ChartCard
            title="MY SCORE VS. THEIR SCORE"
            titleBelow={<>
              <LegendDot color={colors.win}  label="WIN" />
              <LegendDot color={colors.loss} label="LOSS" />
              <LegendDot color={colors.sub}  label="TIE" />
            </>}
          >
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} />
                <XAxis type="number" dataKey="x" domain={[0, 300]} name="You" tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }} axisLine={false} tickLine={false} />
                <YAxis type="number" dataKey="y" domain={[0, 300]} name="Them" tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<ScatterTooltip points={scatterPoints} />} cursor={{ strokeDasharray: '3 3', stroke: colors.border }} />
                {/* Static overlay, not a data series — keeps the tie diagonal out of tooltip hit-testing entirely */}
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 300, y: 300 }]} stroke={colors.border} strokeDasharray="4 4" strokeWidth={1} ifOverflow="extendDomain" />
                <Scatter data={scatterPoints} dataKey="y" isAnimationActive={false}>
                  {scatterPoints.map((p, i) => (
                    <Cell key={i} fill={p.result === 'W' ? colors.win : p.result === 'L' ? colors.loss : colors.sub} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Chart 4 — Rolling Win% Momentum */}
          <ChartCard title="ROLLING 10-MATCH WIN%">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={rollingWinData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="index" padding={{ left: 12, right: 12 }} tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<RollingWinTooltip />} />
                <Line type="monotone" dataKey="rolling" stroke={colors.accent} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: colors.accent, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Chart 5 — Head-to-Head Comparison (requires an opponent selected) */}
          <ChartCard title="HEAD-TO-HEAD COMPARISON">
            {!opponentFilter && (
              <div style={{ textAlign: 'center', paddingTop: 4, paddingBottom: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--sub)' }}>
                Select an opponent above to compare
              </div>
            )}
            {opponentFilter && h2h && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 16, paddingRight: 16 }}>
                <AvgScoreCompare myAvg={h2h.myAvg} oppAvg={h2h.oppAvg} oppName={activeOpponentName} />
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={h2h.diverging} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} horizontal={false} />
                    <XAxis type="number" domain={[-100, 100]} tickFormatter={v => `${Math.abs(v)}%`} tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.sub }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="label" tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: colors.text }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip content={<DivergingTooltip oppName={activeOpponentName} />} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="me"  fill={colors.accent} radius={[3, 0, 0, 3]} isAnimationActive={false} />
                    <Bar dataKey="opp" fill={colors.sub}    radius={[0, 3, 3, 0]} fillOpacity={0.6} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', paddingBottom: 6 }}>
                  <LegendDot color={colors.accent} label="YOU" />
                  <LegendDot color={colors.sub} label={activeOpponentName.toUpperCase()} />
                </div>
              </div>
            )}
          </ChartCard>

        </div>
      )}
    </div>
  )
}
