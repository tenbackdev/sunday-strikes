import { useState, useMemo } from 'react'
import {
  ComposedChart, BarChart,
  Line, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChartCard, LegendDot, StatTable, TooltipShell, TipRow, CalloutStat } from '../../lib/chartUtils'
import { toLocalDateStr, AMBER } from '../../lib/chartFormat'

// Desktop-only (≥1024px) cards for the personal Stats page. Data is precomputed by
// Stats.jsx via lib/frameAnalytics; these components only render.

const MONO = "'JetBrains Mono', monospace"
const GROTESK = "'Space Grotesk', sans-serif"
const tick = colors => ({ fontFamily: MONO, fontSize: 10, fill: colors.sub })
const MARGIN = { left: 0, right: 16, top: 4, bottom: 0 }
const pctFmt = v => `${v}%`

function fmtDay(dateStr, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d ?? 1).toLocaleDateString(undefined, opts)
}

function Empty({ children }) {
  return <div style={{ textAlign: 'center', padding: '40px 16px', fontFamily: MONO, fontSize: 11, color: 'var(--sub)' }}>{children}</div>
}

// ── Overview ─────────────────────────────────────────────────────────────────

export function PersonalRecordsCard({ records }) {
  const line = (label, rec, fmt = v => v) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', borderBottom: '1px solid color-mix(in srgb, var(--border) 55%, transparent)' }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--sub)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{rec ? fmt(rec.value) : '—'}</span>
        {rec && <span style={{ fontFamily: MONO, fontSize: 9.5, color: 'var(--sub)' }}>{fmtDay(rec.date)}</span>}
      </span>
    </div>
  )
  return (
    <ChartCard title="PERSONAL RECORDS">
      <div style={{ padding: '0 16px 6px' }}>
        <div style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sub)', marginBottom: 4 }}>TOP GAMES</div>
        {records.top.map((g, i) => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '4px 0' }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--sub)', width: 14 }}>{i + 1}</span>
            <span style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: i === 0 ? 22 : 16, letterSpacing: '-0.03em', lineHeight: 1.1, color: g.score === 300 ? AMBER : i === 0 ? 'var(--accent)' : 'var(--text)', minWidth: 40 }}>{g.score}</span>
            <span style={{ fontFamily: MONO, fontSize: 9.5, color: 'var(--sub)' }}>{fmtDay(g.date)}</span>
          </div>
        ))}
        <div style={{ marginTop: 8 }}>
          {line('Best 3-game series', records.bestSeries)}
          {line('Best session avg', records.bestSession)}
          {line('Most strikes', records.mostStrikes, v => `${v} X`)}
        </div>
      </div>
    </ChartCard>
  )
}

function SessionOrderTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell title={label === 'G4+' ? 'GAME 4 AND LATER' : `GAME ${label.slice(1)} OF SESSION`}>
      <TipRow label="Avg" value={d.avg ?? '—'} color="var(--accent)" />
      <TipRow label="Games" value={d.count} />
    </TooltipShell>
  )
}

export function SessionOrderCard({ data, colors }) {
  const best = Math.max(...data.map(d => d.avg ?? 0))
  const lowest = Math.min(...data.filter(d => d.avg != null).map(d => d.avg))
  const floor = Math.max(0, Math.floor((lowest - 30) / 50) * 50)
  const ticks = Array.from({ length: Math.floor((300 - floor) / 50) + 1 }, (_, i) => floor + i * 50)
  return (
    <ChartCard title="AVG BY GAME # IN SESSION">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ ...MARGIN, top: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey="label" interval={0} tick={tick(colors)} axisLine={false} tickLine={false} />
          <YAxis domain={[floor, 300]} ticks={ticks} tick={tick(colors)} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<SessionOrderTooltip />} cursor={{ fill: colors.border, fillOpacity: 0.25 }} />
          <Bar dataKey="avg" radius={[3, 3, 0, 0]} isAnimationActive={false} label={{ position: 'top', fontFamily: MONO, fontSize: 10, fontWeight: 700, fill: colors.text }}>
            {data.map((d, i) => <Cell key={i} fill={colors.accent} fillOpacity={d.avg === best ? 1 : 0.35} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// GitHub-style calendar: 53 week columns × 7 weekday rows ending today; each played day is
// shaded by its average relative to the player's own range of session averages.
export function ActivityHeatmap({ byDay, colors }) {
  const [hover, setHover] = useState(null)

  const { weeks, months, lo, hi, played } = useMemo(() => {
    const today = new Date()
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const start = new Date(end)
    start.setDate(start.getDate() - (52 * 7 + end.getDay()))
    const weeks = []
    const months = []
    const cursor = new Date(start)
    while (cursor <= end) {
      const week = []
      for (let d = 0; d < 7; d++) {
        const key = toLocalDateStr(cursor.toISOString())
        week.push(cursor <= end ? { key, ...byDay[key] } : null)
        if (cursor.getDate() === 1 || (weeks.length === 0 && d === 0)) months.push({ col: weeks.length, label: cursor.toLocaleDateString(undefined, { month: 'short' }) })
        cursor.setDate(cursor.getDate() + 1)
      }
      weeks.push(week)
    }
    const avgs = Object.entries(byDay).filter(([k]) => k >= toLocalDateStr(start.toISOString())).map(([, v]) => v.avg)
    return { weeks, months, lo: avgs.length ? Math.min(...avgs) : 0, hi: avgs.length ? Math.max(...avgs) : 0, played: avgs.length }
  }, [byDay])

  const shade = a => hi === lo ? 0.75 : 0.22 + 0.78 * ((a - lo) / (hi - lo))
  const COLS = weeks.length

  return (
    <ChartCard
      title="ACTIVITY — LAST 12 MONTHS"
      titleRight={
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: 'var(--sub)' }}>
          {hover?.games
            ? <>{fmtDay(hover.key, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · {hover.games} {hover.games === 1 ? 'game' : 'games'} · avg <b style={{ color: 'var(--accent)' }}>{hover.avg}</b></>
            : `${played} session${played === 1 ? '' : 's'} · hover a day`}
        </span>
      }
    >
      <div style={{ padding: '0 16px 6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 3, marginBottom: 4 }}>
          {Array.from({ length: COLS }, (_, c) => {
            const m = months.find(x => x.col === c)
            return <span key={c} style={{ fontFamily: MONO, fontSize: 8.5, color: 'var(--sub)', whiteSpace: 'nowrap', overflow: 'visible' }}>{m?.label ?? ''}</span>
          })}
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: 'repeat(7, auto)', gridAutoFlow: 'column', gap: 3 }}
          onMouseLeave={() => setHover(null)}
        >
          {weeks.flatMap((week, wi) => week.map((day, di) => (
            day ? (
              <div
                key={day.key}
                className={day.games ? 'ss-heat-cell' : undefined}
                title={day.games ? `${fmtDay(day.key)} · ${day.games} games · avg ${day.avg}` : undefined}
                onMouseEnter={() => setHover(day)}
                style={{
                  aspectRatio: '1', borderRadius: 2,
                  background: day.games ? colors.accent : 'color-mix(in srgb, var(--border) 45%, transparent)',
                  opacity: day.games ? shade(day.avg) : 1,
                  outline: hover?.key === day.key ? `1px solid ${colors.text}` : 'none',
                }}
              />
            ) : <div key={`pad-${wi}-${di}`} />
          )))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 8, fontFamily: MONO, fontSize: 8.5, color: 'var(--sub)' }}>
          <span>{lo || '—'}</span>
          {[0.22, 0.45, 0.65, 0.85, 1].map(o => <span key={o} style={{ width: 9, height: 9, borderRadius: 2, background: colors.accent, opacity: o }} />)}
          <span>{hi || '—'} avg</span>
        </div>
      </div>
    </ChartCard>
  )
}

export function MonthlyTableCard({ rows }) {
  const delta = d => d == null ? <span style={{ color: 'var(--sub)' }}>—</span>
    : <span style={{ fontWeight: 700, color: d > 0 ? 'var(--win)' : d < 0 ? 'var(--loss)' : 'var(--sub)' }}>{d > 0 ? `+${d}` : d}</span>
  return (
    <ChartCard title="MONTHLY BREAKDOWN">
      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        <StatTable
          rows={rows}
          rowKey={r => r.key}
          defaultSort={{ key: 'key', dir: 'desc' }}
          columns={[
            { key: 'key', label: 'MONTH', align: 'left', sortValue: r => r.key, render: r => <span style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: 12.5 }}>{fmtDay(r.key, { month: 'short', year: 'numeric' })}</span> },
            { key: 'games', label: 'GAMES', sortValue: r => r.games },
            { key: 'avg', label: 'AVG', sortValue: r => r.avg, render: r => <b>{r.avg}</b> },
            { key: 'delta', label: 'Δ AVG', title: 'Change vs. previous month played', sortValue: r => r.delta, render: r => delta(r.delta) },
            { key: 'high', label: 'HIGH', sortValue: r => r.high, render: r => <span style={{ color: r.high === 300 ? AMBER : undefined }}>{r.high}</span> },
            { key: 'low', label: 'LOW', sortValue: r => r.low },
            { key: 'x', label: 'STRIKE %', sortValue: r => r.strikePct, render: r => r.strikePct != null ? `${r.strikePct}%` : '—' },
            { key: 'sp', label: 'SPARE %', sortValue: r => r.sparePct, render: r => r.sparePct != null ? `${r.sparePct}%` : '—' },
          ]}
        />
      </div>
    </ChartCard>
  )
}

// ── Strikes ──────────────────────────────────────────────────────────────────

function FrameRateTooltip({ active, payload, label, kind }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const isStrike = kind === 'strike'
  return (
    <TooltipShell title={`FRAME ${label}`}>
      <TipRow label={isStrike ? 'Strike %' : 'Conv %'} value={(isStrike ? d.strikePct : d.convPct) != null ? `${isStrike ? d.strikePct : d.convPct}%` : 'low sample'} color="var(--accent)" />
      <TipRow label={isStrike ? 'Strikes / racks' : 'Spares / attempts'} value={isStrike ? `${d.strikes} / ${d.racks}` : `${d.spares} / ${d.spareAttempts}`} />
    </TooltipShell>
  )
}

export function FrameRateCard({ title, data, dataKey, kind, colors }) {
  const vals = data.map(d => d[dataKey]).filter(v => v != null)
  const best = vals.length ? Math.max(...vals) : null
  const worst = vals.length ? Math.min(...vals) : null
  return (
    <ChartCard
      title={title}
      titleRight={best != null && (
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: 'var(--sub)' }}>
          best <b style={{ color: 'var(--win)' }}>F{data.find(d => d[dataKey] === best).label}</b> · worst <b style={{ color: 'var(--loss)' }}>F{data.find(d => d[dataKey] === worst).label}</b>
        </span>
      )}
    >
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey="label" interval={0} tick={tick(colors)} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tickFormatter={pctFmt} tick={tick(colors)} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<FrameRateTooltip kind={kind} />} cursor={{ fill: colors.border, fillOpacity: 0.25 }} />
          <Bar dataKey={dataKey} radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={colors.accent} fillOpacity={d[dataKey] === best ? 1 : 0.4} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function MixTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const c = d.counts
  const isTenth = label.startsWith('10')
  return (
    <TooltipShell title={isTenth ? `10TH FRAME · RACK ${label.slice(-1)}` : `FRAME ${label}`}>
      <TipRow label="Strike" value={`${d.strikePct}% (${c.strike})`} color="var(--accent)" />
      {(c.spare + c.open) > 0 && <TipRow label="Spare" value={`${d.sparePct}% (${c.spare})`} />}
      {(c.spare + c.open) > 0 && <TipRow label="Open" value={`${d.openPct}% (${c.open})`} />}
      {c.nostrike > 0 && <TipRow label="No strike (fill ball)" value={`${d.fillPct}% (${c.nostrike})`} />}
      <span style={{ color: 'var(--sub)', fontSize: 10, marginTop: 2 }}>{d.racks} racks{d.lowSample ? ' · low sample' : ''}</span>
    </TooltipShell>
  )
}

export function FrameOutcomeMixCard({ data, colors }) {
  const op = d => d.lowSample ? 0.35 : 1
  return (
    <ChartCard
      title="FRAME OUTCOME MIX — STRIKE / SPARE / OPEN BY FRAME & 10TH-FRAME RACK"
      titleBelow={<>
        <LegendDot color={colors.accent} label="STRIKE" />
        <LegendDot color={colors.third} label="SPARE" />
        <LegendDot color={colors.sub} label="OPEN / NO STRIKE ON FILL" />
      </>}
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={MARGIN} barCategoryGap="18%">
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey="label" interval={0} tick={tick(colors)} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={pctFmt} tick={tick(colors)} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<MixTooltip />} cursor={{ fill: colors.border, fillOpacity: 0.25 }} />
          <Bar dataKey="strikePct" stackId="mix" isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={colors.accent} fillOpacity={0.9 * op(d)} />)}
          </Bar>
          <Bar dataKey="sparePct" stackId="mix" isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={colors.third} fillOpacity={0.85 * op(d)} />)}
          </Bar>
          <Bar dataKey="openPct" stackId="mix" isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={colors.sub} fillOpacity={0.55 * op(d)} />)}
          </Bar>
          <Bar dataKey="fillPct" stackId="mix" isAnimationActive={false} radius={[3, 3, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={colors.sub} fillOpacity={0.3 * op(d)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function RollingPctTooltip({ active, payload, label, name, suffix = '%' }) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value
  return (
    <TooltipShell title={`GAME ${label}`}>
      <TipRow label={name} value={v != null ? `${v}${suffix}` : '—'} color="var(--accent)" />
    </TooltipShell>
  )
}

export function RollingLineCard({ title, data, dataKey, colors, domain, tickFormatter, name, suffix }) {
  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey="index" padding={{ left: 12, right: 12 }} interval="preserveStartEnd" tick={tick(colors)} axisLine={false} tickLine={false} />
          <YAxis domain={domain} tickFormatter={tickFormatter} tick={tick(colors)} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<RollingPctTooltip name={name} suffix={suffix} />} />
          <Line type="monotone" dataKey={dataKey} stroke={colors.accent} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: colors.accent, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ── Spares ───────────────────────────────────────────────────────────────────

function OpensTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const n = payload[0]?.value
  return (
    <TooltipShell title={`${label} OPEN${label === '1' ? '' : 'S'}`}>
      <TipRow label="Games" value={n} />
    </TooltipShell>
  )
}

export function OpensDistCard({ data, cleanPct, colors }) {
  return (
    <ChartCard
      title="OPEN FRAMES PER GAME"
      titleRight={<span style={{ fontFamily: MONO, fontSize: 9.5, color: 'var(--sub)' }}>clean games <b style={{ color: 'var(--win)' }}>{cleanPct}%</b></span>}
    >
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey="label" interval={0} tick={tick(colors)} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={tick(colors)} axisLine={false} tickLine={false} width={30} />
          <Tooltip content={<OpensTooltip />} cursor={{ fill: colors.border, fillOpacity: 0.25 }} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={i === 0 ? colors.win : colors.accent} fillOpacity={d.isMax ? 1 : 0.4} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function OpportunityCostCard({ avgScore, lostAll, lostNonSplit, hasEstimate }) {
  const bar = (label, value, max, color) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 10, color: 'var(--sub)' }}>
        <span>{label}</span><b style={{ color: 'var(--text)', fontFamily: GROTESK, fontSize: 13 }}>{value}</b>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--elevated)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, (value / max) * 100)}%`, background: color, borderRadius: 4 }} />
      </div>
    </div>
  )
  const max = Math.min(300, avgScore + lostAll)
  return (
    <ChartCard title="SPARE OPPORTUNITY COST">
      <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 28 }}>
          <CalloutStat label="PINS LEFT ON THE LANE / GAME" value={lostAll.toFixed(1)} color="var(--loss)" />
          <CalloutStat label="OF WHICH NON-SPLIT" value={lostNonSplit.toFixed(1)} />
        </div>
        {bar('Your average', avgScore, max, 'var(--sub)')}
        {bar('Convert every non-split spare', Math.min(300, Math.round(avgScore + lostNonSplit)), max, 'color-mix(in srgb, var(--accent) 60%, transparent)')}
        {bar('Convert every spare', Math.min(300, Math.round(avgScore + lostAll)), max, 'var(--accent)')}
        <p style={{ fontFamily: MONO, fontSize: 9.5, lineHeight: 1.6, color: 'var(--sub)', margin: 0 }}>
          Missed pins plus the next-ball bonus a spare would have earned.{hasEstimate ? ' 10th-frame fill balls use your career first-ball average.' : ''}
        </p>
      </div>
    </ChartCard>
  )
}

export function LeaveTableCard({ rows: allRows, filterLabel }) {
  // Leaves never faced are noise in a table (the chart beside it keeps the full fixed axis)
  const rows = allRows.filter(r => r.count > 0)
  const total = rows.reduce((s, r) => s + r.count, 0)
  return (
    <ChartCard title={`LEAVES — ${filterLabel.toUpperCase()}`}>
      <StatTable
        rows={rows}
        rowKey={r => r.label}
        emptyText="No leaves for this filter"
        defaultSort={{ key: 'label', dir: 'asc' }}
        columns={[
          { key: 'label', label: 'PINS LEFT', align: 'left', sortValue: r => r.order, render: r => <b style={{ fontFamily: GROTESK }}>{r.label}</b> },
          { key: 'count', label: 'ATTEMPTS', sortValue: r => r.count },
          { key: 'share', label: '% OF LEAVES', sortValue: r => r.count, render: r => total ? `${Math.round((r.count / total) * 100)}%` : '—' },
          { key: 'converted', label: 'MADE', sortValue: r => r.converted },
          {
            key: 'rate', label: 'CONV %', sortValue: r => r.count ? r.converted / r.count : null,
            render: r => r.count
              ? <b style={{ color: r.count >= 10 ? 'var(--accent)' : 'var(--sub)' }}>{Math.round((r.converted / r.count) * 100)}%</b>
              : <span style={{ color: 'var(--sub)' }}>—</span>,
          },
        ]}
      />
    </ChartCard>
  )
}

// ── Pins ─────────────────────────────────────────────────────────────────────

export function ScoreCompositionCard({ composition, bonusPerStrike, bonusPerSpare, colors }) {
  const parts = [
    { key: 'firstBall',   label: 'FIRST BALL',   color: colors.accent, op: 1 },
    { key: 'secondBall',  label: 'SPARE BALL',   color: colors.third,  op: 1 },
    { key: 'strikeBonus', label: 'STRIKE BONUS', color: colors.accent, op: 0.45 },
    { key: 'spareBonus',  label: 'SPARE BONUS',  color: colors.third,  op: 0.45 },
  ]
  const total = parts.reduce((s, p) => s + composition[p.key], 0)
  return (
    <ChartCard title="SCORE COMPOSITION — WHERE YOUR AVERAGE COMES FROM">
      <div style={{ padding: '4px 16px 10px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', background: 'var(--elevated)', gap: 2 }}>
          {parts.map(p => {
            const w = total ? (composition[p.key] / total) * 100 : 0
            return (
              <div key={p.key} title={`${p.label}: ${composition[p.key]}`} style={{ width: `${w}%`, background: p.color, opacity: p.op }} />
            )
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {parts.map(p => (
            <div key={p.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, opacity: p.op }} />
                <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--sub)' }}>{p.label}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: 20, letterSpacing: '-0.03em', color: 'var(--text)' }}>{composition[p.key].toFixed(1)}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--sub)' }}>{total ? Math.round((composition[p.key] / total) * 100) : 0}%</span>
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 32, paddingTop: 12, borderTop: '1px solid color-mix(in srgb, var(--border) 55%, transparent)' }}>
          <CalloutStat label="AVG BONUS / STRIKE" value={bonusPerStrike ?? '—'} sub="of a possible 20 (frames 1–9)" color="var(--accent)" />
          <CalloutStat label="AVG BONUS / SPARE" value={bonusPerSpare ?? '—'} sub="of a possible 10 — your next first ball" />
        </div>
        <p style={{ fontFamily: MONO, fontSize: 9.5, color: 'var(--sub)', margin: 0 }}>
          Per-game averages · sum {total.toFixed(1)} = your average. Bonus is the extra credit strikes and spares earn from the next balls.
        </p>
      </div>
    </ChartCard>
  )
}

function PointsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell title={`FRAME ${label}`}>
      <TipRow label="Avg points" value={d.points} color="var(--accent)" />
      {d.firstBallAvg != null && <TipRow label="1st ball avg" value={d.firstBallAvg} />}
    </TooltipShell>
  )
}

export function PointsPerFrameCard({ data, colors }) {
  if (!data.length) return <ChartCard title="AVG POINTS PER FRAME"><Empty>No data</Empty></ChartCard>
  return (
    <ChartCard
      title="AVG POINTS PER FRAME"
      titleBelow={<>
        <LegendDot color={colors.accent} label="POINTS (INCL. BONUS)" />
        <LegendDot color={colors.third} label="1ST BALL AVG" />
      </>}
    >
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey="label" interval={0} tick={tick(colors)} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" domain={[0, 30]} ticks={[0, 10, 20, 30]} tick={tick(colors)} axisLine={false} tickLine={false} width={30} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 10]} tick={tick(colors)} axisLine={false} tickLine={false} width={30} />
          <Tooltip content={<PointsTooltip />} cursor={{ fill: colors.border, fillOpacity: 0.25 }} />
          <Bar yAxisId="left" dataKey="points" fill={colors.accent} fillOpacity={0.45} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Line yAxisId="right" type="monotone" dataKey="firstBallAvg" stroke={colors.third} strokeWidth={2} dot={{ r: 3, fill: colors.third, strokeWidth: 0 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
