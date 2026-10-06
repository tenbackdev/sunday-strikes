import {
  ComposedChart, BarChart,
  Line, Bar, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChartCard, LegendDot, Ribbon, StatTable, TooltipShell, TipRow, CalloutStat } from '../../lib/chartUtils'
import { avatarStyle } from '../../lib/avatar'

// Desktop-only (≥1024px) cards for the VS Stats page. All data is precomputed by the
// page via lib/frameAnalytics; these components only render.

const MONO = "'JetBrains Mono', monospace"
const GROTESK = "'Space Grotesk', sans-serif"
const tick = colors => ({ fontFamily: MONO, fontSize: 10, fill: colors.sub })
const MARGIN = { left: 0, right: 16, top: 4, bottom: 0 }
const signed = v => v > 0 ? `+${v}` : `${v}`
const resultColor = r => r === 'W' ? 'var(--win)' : r === 'L' ? 'var(--loss)' : 'var(--sub)'

export function VSSummaryRibbon({ summary }) {
  const streak = summary.current
  return (
    <Ribbon stats={[
      { label: 'RECORD',       value: summary.record },
      { label: 'WIN %',        value: `${summary.winPct}%` },
      { label: 'AVG PIN DIFF', value: signed(summary.avgDiff) },
      { label: 'CURRENT',      value: streak ? `${streak.result}${streak.count}` : '—' },
      { label: 'BEST W STREAK', value: summary.longestWin },
      { label: 'AVG WIN BY',   value: summary.avgWinMargin != null ? `+${summary.avgWinMargin}` : '—' },
      { label: 'AVG LOSS BY',  value: summary.avgLossMargin != null ? `−${summary.avgLossMargin}` : '—' },
    ]} />
  )
}

function FrameLeadTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell title={`AFTER FRAME ${label}`}>
      <TipRow label="Avg lead" value={signed(d.lead)} color={d.lead >= 0 ? 'var(--win)' : 'var(--loss)'} />
      <TipRow label="Trailing" value={`${d.trailing} · won ${d.comebacks}`} />
      <TipRow label="Leading" value={`${d.leading} · lost ${d.blown}`} />
    </TooltipShell>
  )
}

export function FrameLeadCard({ data, colors }) {
  const f7 = data[6]
  const f9 = data[8]
  return (
    <ChartCard title="WHERE MATCHES ARE WON — AVG LEAD BY FRAME">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey="label" interval={0} tick={tick(colors)} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={signed} tick={tick(colors)} axisLine={false} tickLine={false} width={36} />
          <ReferenceLine y={0} stroke={colors.sub} strokeOpacity={0.5} />
          <Tooltip content={<FrameLeadTooltip />} cursor={{ fill: colors.border, fillOpacity: 0.25 }} />
          <Bar dataKey="lead" radius={[3, 3, 3, 3]} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={d.lead >= 0 ? colors.win : colors.loss} fillOpacity={0.8} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 32, padding: '8px 16px 4px' }}>
        <CalloutStat
          label="COMEBACKS"
          value={`${f7.comebacks} / ${f7.trailing}`}
          sub="won when trailing after frame 7"
          color={f7.comebacks > 0 ? 'var(--win)' : 'var(--text)'}
        />
        <CalloutStat
          label="CLOSE-OUT"
          value={f9.leading > 0 ? `${f9.leading - f9.blown} / ${f9.leading}` : '—'}
          sub="won when leading after frame 9"
        />
      </div>
    </ChartCard>
  )
}

function WinLossTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell title={`${label.toUpperCase()} / GAME`}>
      <TipRow label="In wins" value={d.win} color="var(--win)" />
      <TipRow label="In losses" value={d.loss} color="var(--loss)" />
    </TooltipShell>
  )
}

export function WinLossCard({ profile, colors }) {
  const enough = profile.wins > 0 && profile.losses > 0
  return (
    <ChartCard
      title="WINS VS. LOSSES — YOUR GAME"
      titleBelow={<>
        <LegendDot color={colors.win} label={`IN WINS (${profile.wins})`} />
        <LegendDot color={colors.loss} label={`IN LOSSES (${profile.losses})`} />
      </>}
    >
      {enough ? (
        <ResponsiveContainer width="100%" height={232}>
          <BarChart data={profile.rows} margin={MARGIN} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
            <XAxis dataKey="label" interval={0} tick={tick(colors)} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={tick(colors)} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<WinLossTooltip />} cursor={{ fill: colors.border, fillOpacity: 0.25 }} />
            <Bar dataKey="win"  fill={colors.win}  fillOpacity={0.8} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="loss" fill={colors.loss} fillOpacity={0.8} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 16px', fontFamily: MONO, fontSize: 11, color: 'var(--sub)' }}>
          Needs at least one win and one loss
        </div>
      )}
    </ChartCard>
  )
}

function FormDots({ results }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {results.map((r, i) => (
        <span key={i} title={r} style={{ width: 7, height: 7, borderRadius: '50%', background: r === 'T' ? 'var(--border)' : resultColor(r) }} />
      ))}
    </span>
  )
}

export function OpponentLeaderboard({ opponentStats, activeId, onSelect }) {
  const rows = opponentStats.map(s => {
    const total = s.w + s.l + s.t
    const name = s.profile?.display_name || s.profile?.email || 'Opponent'
    return {
      id: s.profile?.id,
      name,
      color: s.profile?.avatar_color,
      total,
      record: `${s.w}-${s.l}${s.t ? `-${s.t}` : ''}`,
      winPct: total ? Math.round((s.w / total) * 100) : 0,
      myAvg: total ? Math.round(s.myPins / total) : 0,
      oppAvg: total ? Math.round(s.oppPins / total) : 0,
      diff: total ? Math.round((s.myPins - s.oppPins) / total) : 0,
      myX: s.myRacks ? Math.round((s.myStrikes / s.myRacks) * 100) : null,
      oppX: s.oppRacks ? Math.round((s.oppStrikes / s.oppRacks) * 100) : null,
      mySp: (s.mySpares + s.myOpens) ? Math.round((s.mySpares / (s.mySpares + s.myOpens)) * 100) : null,
      oppSp: (s.oppSpares + s.oppOpens) ? Math.round((s.oppSpares / (s.oppSpares + s.oppOpens)) * 100) : null,
      form: s.matches.slice(0, 5).map(m => m.result),
    }
  })
  const pctCell = (mine, theirs) => (
    <span>
      <span style={{ fontWeight: 700, color: mine != null && theirs != null && mine > theirs ? 'var(--win)' : 'var(--text)' }}>{mine ?? '—'}</span>
      <span style={{ color: 'var(--sub)' }}> / {theirs ?? '—'}</span>
    </span>
  )
  const columns = [
    {
      key: 'name', label: 'OPPONENT', align: 'left', sortValue: r => r.name.toLowerCase(),
      render: r => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...avatarStyle(r.color), width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
            {r.name.slice(0, 2).toUpperCase()}
          </span>
          <span style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: 13 }}>{r.name}</span>
        </span>
      ),
    },
    { key: 'total',  label: 'M',       sortValue: r => r.total },
    { key: 'record', label: 'W-L-T',   sortValue: r => r.winPct, render: r => r.record },
    { key: 'winPct', label: 'WIN %',   sortValue: r => r.winPct, render: r => <span style={{ fontWeight: 700, color: r.winPct >= 50 ? 'var(--win)' : 'var(--loss)' }}>{r.winPct}%</span> },
    { key: 'avg',    label: 'AVG (YOU / THEM)', sortValue: r => r.myAvg, render: r => pctCell(r.myAvg, r.oppAvg) },
    { key: 'diff',   label: 'AVG DIFF', sortValue: r => r.diff, render: r => <span style={{ fontWeight: 700, color: r.diff > 0 ? 'var(--win)' : r.diff < 0 ? 'var(--loss)' : 'var(--sub)' }}>{signed(r.diff)}</span> },
    { key: 'x',      label: 'STRIKE %', title: 'You / them', sortValue: r => r.myX, render: r => pctCell(r.myX, r.oppX) },
    { key: 'sp',     label: 'SPARE %',  title: 'You / them', sortValue: r => r.mySp, render: r => pctCell(r.mySp, r.oppSp) },
    { key: 'form',   label: 'LAST 5', render: r => <FormDots results={r.form} /> },
  ]
  return (
    <ChartCard title="OPPONENT LEADERBOARD — CLICK A ROW TO FOCUS">
      <StatTable
        columns={columns}
        rows={rows}
        rowKey={r => r.id}
        defaultSort={{ key: 'total', dir: 'desc' }}
        activeRowKey={activeId}
        onRowClick={r => onSelect(r.id)}
      />
    </ChartCard>
  )
}

function TimelineTooltip({ active, payload, oppName }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const [y, m, day] = d.date.split('-').map(Number)
  return (
    <TooltipShell title={`MATCH ${d.index} · ${new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}>
      <TipRow label="You" value={d.me} color={resultColor(d.result)} />
      <TipRow label={oppName} value={d.them} />
      <TipRow label="Net W−L" value={signed(d.net)} color={d.net >= 0 ? 'var(--win)' : 'var(--loss)'} />
    </TooltipShell>
  )
}

export function OpponentTimelineCard({ timeline, colors, oppName }) {
  return (
    <ChartCard
      title={`SCORE TIMELINE VS. ${oppName.toUpperCase()}`}
      titleBelow={<>
        <LegendDot color={colors.accent} label="YOU" />
        <LegendDot color={colors.sub} label={oppName.toUpperCase()} />
      </>}
    >
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={timeline} margin={MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey="index" padding={{ left: 12, right: 12 }} interval="preserveStartEnd" tick={tick(colors)} axisLine={false} tickLine={false} />
          <YAxis domain={[dataMin => Math.max(0, Math.floor((dataMin - 10) / 10) * 10), 300]} tick={tick(colors)} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<TimelineTooltip oppName={oppName} />} />
          <Line type="monotone" dataKey="them" stroke={colors.sub} strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2.5, fill: colors.sub, strokeWidth: 0 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="me" stroke={colors.accent} strokeWidth={2.5} dot={{ r: 3, fill: colors.accent, strokeWidth: 0 }} activeDot={{ r: 5, fill: colors.accent, strokeWidth: 0 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function NetRecordCard({ timeline, colors }) {
  return (
    <ChartCard title="NET RECORD — CUMULATIVE WINS MINUS LOSSES">
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={timeline} margin={MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey="index" padding={{ left: 12, right: 12 }} interval="preserveStartEnd" tick={tick(colors)} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tickFormatter={signed} tick={tick(colors)} axisLine={false} tickLine={false} width={36} />
          <ReferenceLine y={0} stroke={colors.sub} strokeOpacity={0.5} />
          <Tooltip content={<TimelineTooltip oppName="Them" />} />
          <Line type="stepAfter" dataKey="net" stroke={colors.third} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: colors.third, strokeWidth: 0 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// Side-by-side metric table; the better value in each row is emphasised.
export function H2HTableCard({ me, them, oppName }) {
  const f1 = v => v == null ? '—' : v.toFixed(1)
  const p = v => v == null ? '—' : `${v}%`
  const rows = [
    { key: 'avg',   label: 'Average',          me: me.avg, them: them.avg, fmt: v => v, higher: true },
    { key: 'high',  label: 'High game',        me: me.high, them: them.high, fmt: v => v, higher: true },
    { key: 'low',   label: 'Low game',         me: me.low, them: them.low, fmt: v => v, higher: true },
    { key: 'x',     label: 'Strike %',         me: me.strikePct, them: them.strikePct, fmt: p, higher: true },
    { key: 'sp',    label: 'Spare conv %',     me: me.sparePct, them: them.sparePct, fmt: p, higher: true },
    { key: 'split', label: 'Split conv %',     me: me.splitConvPct, them: them.splitConvPct, fmt: p, higher: true },
    { key: 'open',  label: 'Opens / game',     me: me.opensPerGame, them: them.opensPerGame, fmt: f1, higher: false },
    { key: 'fb',    label: '1st ball avg',     me: me.firstBallAvg, them: them.firstBallAvg, fmt: v => v.toFixed(2), higher: true },
    { key: '200',   label: '200+ games',       me: me.games200, them: them.games200, fmt: v => v, higher: true },
  ]
  const cell = (row, side) => {
    const mine = row.me, theirs = row.them
    const better = mine != null && theirs != null && mine !== theirs && ((mine > theirs) === row.higher)
    const isBest = side === 'me' ? better : (mine != null && theirs != null && mine !== theirs && !better)
    return <span style={{ fontWeight: isBest ? 700 : 400, color: isBest ? (side === 'me' ? 'var(--accent)' : 'var(--text)') : 'var(--sub)' }}>{row.fmt(row[side])}</span>
  }
  return (
    <ChartCard title="HEAD-TO-HEAD — FULL BREAKDOWN">
      <StatTable
        columns={[
          { key: 'label', label: 'METRIC', align: 'left', render: r => <span style={{ color: 'var(--sub)' }}>{r.label}</span> },
          { key: 'me',    label: 'YOU', render: r => cell(r, 'me') },
          { key: 'them',  label: oppName.toUpperCase(), render: r => cell(r, 'them') },
        ]}
        rows={rows}
        rowKey={r => r.key}
      />
    </ChartCard>
  )
}
