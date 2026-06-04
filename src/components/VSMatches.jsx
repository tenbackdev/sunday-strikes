import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { FrameGrid } from './Scorecard'
import { computeStats, isConvertedSplit } from '../lib/parseGame'
import { avatarStyle } from '../lib/avatar'

const FIXED_H = 56

const TIME_FILTERS = [
  { key: 'all',  label: 'All Time' },
  { key: 'year', label: 'This Year' },
  { key: '3mo',  label: '3 Months' },
  { key: '30d',  label: '30 Days' },
]

function computeDaySummary(games) {
  const count = games.length
  const scores = games.map(g => g.total_score)
  const totalPins = scores.reduce((s, v) => s + v, 0)
  let strikes = 0, spares = 0, opens = 0, splits = 0, converted = 0
  for (const g of games) {
    const st = computeStats(g.frames ?? [])
    strikes += st.strikes; spares += st.spares; opens += st.opens
    splits += g.frames?.filter(f => f?.split).length ?? 0
    converted += g.frames?.filter(f => isConvertedSplit(f)).length ?? 0
  }
  return {
    count, totalPins,
    avgScore: count > 0 ? Math.round(totalPins / count) : 0,
    highScore: count > 0 ? Math.max(...scores) : 0,
    lowScore: count > 0 ? Math.min(...scores) : 0,
    strikes, spares, opens, splits, converted,
  }
}

function VSDaySummary({ matches, opponentName }) {
  const myGames = matches.map(m => m.myGame).filter(Boolean)
  const theirGames = matches.map(m => m.theirGame).filter(Boolean)
  const mine = computeDaySummary(myGames)
  const theirs = opponentName ? computeDaySummary(theirGames) : null
  const date = matches[0] ? new Date(matches[0].played_at) : null
  const dateStr = date ? date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) : ''

  const statRows = [
    ['Total Pins', mine.totalPins, theirs?.totalPins],
    ['Avg Score',  mine.avgScore,  theirs?.avgScore],
    ['High / Low', `${mine.highScore}/${mine.lowScore}`, theirs ? `${theirs.highScore}/${theirs.lowScore}` : null],
    ['Strikes',   mine.strikes,   theirs?.strikes],
    ['Spares',    mine.spares,    theirs?.spares],
    ['Opens',     mine.opens,     theirs?.opens],
  ]

  return (
    <div className="rounded-xl px-3 py-3" style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{dateStr}</p>
        <p className="text-xs" style={{ color: 'var(--sub)' }}>{matches.length} match{matches.length !== 1 ? 'es' : ''}</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left font-normal pb-1 w-20" style={{ color: 'var(--sub)' }} />
            <th className="text-center pb-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>You</th>
            {theirs && <th className="text-center pb-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>{opponentName}</th>}
          </tr>
        </thead>
        <tbody>
          {statRows.map(([label, myVal, theirVal]) => (
            <tr key={label}>
              <td className="py-0.5" style={{ color: 'var(--sub)' }}>{label}</td>
              <td className="text-center py-0.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--text)' }}>{myVal}</td>
              {theirs && <td className="text-center py-0.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--sub)' }}>{theirVal}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function resultStyle(r) {
  if (r === 'W') return { background: 'color-mix(in srgb, var(--win) 15%, transparent)', color: 'var(--win)' }
  if (r === 'L') return { background: 'color-mix(in srgb, var(--loss) 15%, transparent)', color: 'var(--loss)' }
  return { background: 'color-mix(in srgb, var(--sub) 12%, transparent)', color: 'var(--sub)' }
}

function StatCard({ label, value, sub, nowrap }) {
  return (
    <div
      className="rounded-xl px-4 py-3 text-center"
      style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sub)' }}>{label}</p>
      <p className="mt-0.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: nowrap ? 'clamp(12px, 4vw, 28px)' : 30, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text)', whiteSpace: nowrap ? 'nowrap' : undefined }}>{value}</p>
      {sub && <p className="text-[10px]" style={{ color: 'var(--sub)' }}>{sub}</p>}
    </div>
  )
}

function MatchRow({ match }) {
  const [expanded, setExpanded] = useState(false)
  const date = new Date(match.played_at)
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  const oppName = match.opponentProfile?.display_name || match.opponentProfile?.email || 'Opponent'

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold" style={resultStyle(match.result)}>
          {match.result}
        </span>
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--text)' }}>
            <span style={{ color: match.result === 'W' ? 'var(--win)' : match.result === 'L' ? 'var(--loss)' : 'var(--text)' }}>
              {match.myGame?.total_score ?? '—'}
            </span>
            <span className="mx-1.5" style={{ color: 'var(--border)', fontWeight: 400 }}>vs</span>
            <span style={{ color: 'var(--sub)' }}>{match.theirGame?.total_score ?? '—'}</span>
          </p>
          <p className="text-xs" style={{ color: 'var(--sub)' }}>{oppName} · {dateStr}</p>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ color: 'var(--sub)' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && match.myGame?.frames && match.theirGame?.frames && (
        <div className="px-4 pb-4 pt-3 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sub)' }}>
              You — {match.myGame.total_score}
            </p>
            <FrameGrid frames={match.myGame.frames} />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sub)' }}>
              {oppName} — {match.theirGame.total_score}
            </p>
            <FrameGrid frames={match.theirGame.frames} />
          </div>
        </div>
      )}
    </div>
  )
}

function OpponentCard({ stats, onFilter, isActive, statView, onStatViewChange }) {
  const name = stats.profile?.display_name || stats.profile?.email || 'Opponent'
  const initials = name.slice(0, 2).toUpperCase()
  const total = stats.w + stats.l + stats.t
  const winPct = total > 0 ? Math.round(stats.w / total * 100) : 0
  const myAvg = total > 0 ? Math.round(stats.myPins / total) : 0
  const oppAvg = total > 0 ? Math.round(stats.oppPins / total) : 0
  const last5 = stats.matches.slice(0, 5).map(m => m.result)

  const mySparePct = (stats.mySpares + stats.myOpens) > 0
    ? Math.round(stats.mySpares / (stats.mySpares + stats.myOpens) * 100) : 0
  const oppSparePct = (stats.oppSpares + stats.oppOpens) > 0
    ? Math.round(stats.oppSpares / (stats.oppSpares + stats.oppOpens) * 100) : 0

  const statModes = [
    { key: 'record', label: 'W/L' },
    { key: 'pins',   label: 'Pins' },
    { key: 'strikes', label: 'Strikes' },
    { key: 'spares', label: 'Spares' },
  ]

  return (
    <div
      className="w-full rounded-xl px-4 py-3 transition-colors"
      style={{
        border: `1px solid ${isActive ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 30%, var(--border))'}`,
        background: isActive ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'var(--card)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Tappable top row — triggers filter */}
      <button
        onClick={onFilter}
        className="flex w-full items-center gap-3 mb-2 text-left"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={avatarStyle(stats.profile?.avatar_color)}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{name}</p>
          <p className="text-xs" style={{ color: 'var(--sub)' }}>
            {stats.w}W-{stats.l}L{stats.t > 0 ? `-${stats.t}T` : ''} · {winPct}% win
          </p>
        </div>
        {isActive && (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent)' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Stat view toggle */}
      <div className="mb-2 flex gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>
        {statModes.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onStatViewChange(key)}
            className="flex-1 rounded-md py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors"
            style={statView === key
              ? { background: 'var(--accent)', color: 'var(--acc-text)' }
              : { color: 'var(--sub)' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stat display */}
      {statView === 'record' && (
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--sub)' }}>
          <span>
            Avg: <span className="font-semibold" style={{ color: 'var(--text)' }}>{myAvg}</span>
            {' '}vs <span className="font-semibold" style={{ color: 'var(--sub)' }}>{oppAvg}</span>
          </span>
          <div className="flex gap-1">
            {last5.map((r, i) => (
              <span key={i} className="inline-block h-2 w-2 rounded-full"
                style={{ background: r === 'W' ? 'var(--win)' : r === 'L' ? 'var(--loss)' : 'var(--border)' }} />
            ))}
          </div>
        </div>
      )}

      {statView === 'pins' && (
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--sub)' }}>
          <span>
            Me: <span className="font-semibold" style={{ color: 'var(--text)' }}>{stats.myPins}</span>
            {' '}pins · <span className="font-semibold" style={{ color: 'var(--text)' }}>{myAvg}</span>/game
          </span>
          <span>
            Them: <span className="font-semibold" style={{ color: 'var(--sub)' }}>{stats.oppPins}</span>
            {' '}· <span className="font-semibold" style={{ color: 'var(--sub)' }}>{oppAvg}</span>/game
          </span>
        </div>
      )}

      {statView === 'strikes' && (
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--sub)' }}>
          <span>
            Me: <span className="font-semibold" style={{ color: 'var(--text)' }}>{stats.myStrikes}</span>
            {' '}X · <span className="font-semibold" style={{ color: 'var(--text)' }}>{total > 0 ? (stats.myStrikes / total).toFixed(1) : '—'}</span>/game
          </span>
          <span>
            Them: <span className="font-semibold" style={{ color: 'var(--sub)' }}>{stats.oppStrikes}</span>
            {' '}· <span className="font-semibold" style={{ color: 'var(--sub)' }}>{total > 0 ? (stats.oppStrikes / total).toFixed(1) : '—'}</span>/game
          </span>
        </div>
      )}

      {statView === 'spares' && (
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--sub)' }}>
          <span>
            Me: <span className="font-semibold" style={{ color: 'var(--text)' }}>{mySparePct}%</span>
            {' '}<span style={{ color: 'color-mix(in srgb, var(--sub) 60%, transparent)' }}>({stats.mySpares}/{stats.mySpares + stats.myOpens})</span>
          </span>
          <span>
            Them: <span className="font-semibold" style={{ color: 'var(--sub)' }}>{oppSparePct}%</span>
            {' '}<span style={{ color: 'color-mix(in srgb, var(--sub) 60%, transparent)' }}>({stats.oppSpares}/{stats.oppSpares + stats.oppOpens})</span>
          </span>
        </div>
      )}
    </div>
  )
}

export default function VSMatches({ session }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState('all')
  const [opponentFilter, setOpponentFilter] = useState(null)
  const [cardStatView, setCardStatView] = useState({})
  const getCardView = id => cardStatView[id] ?? 'record'

  async function loadVsData() {
    setLoading(true)
    const userId = session.user.id
    const { data: matchRows } = await supabase
      .from('vs_matches')
      .select('id, submitter_id, opponent_id, submitter_game_id, opponent_game_id, played_at')
      .or(`submitter_id.eq.${userId},opponent_id.eq.${userId}`)
      .order('played_at', { ascending: false })

    if (!matchRows || matchRows.length === 0) { setMatches([]); setLoading(false); return }

    const allUserIds = [...new Set(matchRows.flatMap(m => [m.submitter_id, m.opponent_id]))]
    const allGameIds = matchRows.flatMap(m => [m.submitter_game_id, m.opponent_game_id])

    const [profilesRes, gamesRes] = await Promise.all([
      supabase.from('profiles').select('id, display_name, email, avatar_color').in('id', allUserIds),
      supabase.from('games').select('id, user_id, total_score, frames').in('id', allGameIds),
    ])

    const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]))
    const gameMap = Object.fromEntries((gamesRes.data || []).map(g => [g.id, g]))

    const enriched = matchRows.map(m => {
      const iAmSubmitter = m.submitter_id === userId
      const myGame = gameMap[iAmSubmitter ? m.submitter_game_id : m.opponent_game_id]
      const theirGame = gameMap[iAmSubmitter ? m.opponent_game_id : m.submitter_game_id]
      const opponentId = iAmSubmitter ? m.opponent_id : m.submitter_id
      const opponentProfile = profileMap[opponentId] ?? { id: opponentId }
      const myScore = myGame?.total_score ?? 0
      const theirScore = theirGame?.total_score ?? 0
      const result = myScore > theirScore ? 'W' : myScore < theirScore ? 'L' : 'T'
      return { ...m, myGame, theirGame, opponentProfile, result }
    })

    setMatches(enriched)
    setLoading(false)
  }

  useEffect(() => { loadVsData() }, [])

  const now = new Date()
  const timeFiltered = matches.filter(m => {
    const d = new Date(m.played_at)
    if (timeFilter === 'year') return d.getFullYear() === now.getFullYear()
    if (timeFilter === '3mo') return d >= new Date(now - 90 * 86400000)
    if (timeFilter === '30d') return d >= new Date(now - 30 * 86400000)
    return true
  })
  const filtered = timeFiltered.filter(m => !opponentFilter || m.opponentProfile?.id === opponentFilter)

  const totalW = filtered.filter(m => m.result === 'W').length
  const totalL = filtered.filter(m => m.result === 'L').length
  const totalT = filtered.filter(m => m.result === 'T').length
  const total = filtered.length
  const winPct = total > 0 ? Math.round(totalW / total * 100) : 0
  const avgMyScore = total > 0 ? Math.round(filtered.reduce((s, m) => s + (m.myGame?.total_score ?? 0), 0) / total) : 0
  const totalPinDiff = filtered.reduce((s, m) => s + ((m.myGame?.total_score ?? 0) - (m.theirGame?.total_score ?? 0)), 0)

  const byOpponent = {}
  timeFiltered.forEach(m => {
    const key = m.opponentProfile?.id
    if (!key) return
    if (!byOpponent[key]) byOpponent[key] = {
      profile: m.opponentProfile, w: 0, l: 0, t: 0,
      myPins: 0, oppPins: 0,
      myStrikes: 0, oppStrikes: 0,
      mySpares: 0, oppSpares: 0,
      myOpens: 0, oppOpens: 0,
      matches: [],
    }
    const b = byOpponent[key]
    if (m.result === 'W') b.w++; else if (m.result === 'L') b.l++; else b.t++
    b.myPins += m.myGame?.total_score ?? 0
    b.oppPins += m.theirGame?.total_score ?? 0
    if (m.myGame?.frames) {
      const s = computeStats(m.myGame.frames)
      b.myStrikes += s.strikes; b.mySpares += s.spares; b.myOpens += s.opens
    }
    if (m.theirGame?.frames) {
      const s = computeStats(m.theirGame.frames)
      b.oppStrikes += s.strikes; b.oppSpares += s.spares; b.oppOpens += s.opens
    }
    b.matches.push(m)
  })
  const opponentStats = Object.values(byOpponent).sort((a, b) => (b.w + b.l + b.t) - (a.w + a.l + a.t))

  const activeOpponentName = opponentFilter
    ? opponentStats.find(s => s.profile?.id === opponentFilter)?.profile?.display_name ||
      opponentStats.find(s => s.profile?.id === opponentFilter)?.profile?.email || 'Opponent'
    : null

  const matchesByDate = filtered.reduce((acc, m) => {
    const key = new Date(m.played_at).toDateString()
    if (!acc[key]) acc[key] = { date: new Date(m.played_at), matches: [] }
    acc[key].matches.push(m)
    return acc
  }, {})
  const matchDateGroups = Object.values(matchesByDate).sort((a, b) => b.date - a.date)
  const recordStr = `${totalW}W-${totalL}L${totalT > 0 ? `-${totalT}T` : ''}`

  if (loading) {
    return <div className="flex justify-center py-16 text-sm" style={{ color: 'var(--sub)' }}>Loading VS history…</div>
  }

  return (
    <div className="space-y-0" style={{ marginTop: -24 }}>

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
      </div>

      {/* Body */}
      <div className="space-y-6 pt-2">
        {matches.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-2xl py-16"
            style={{ border: '2px dashed var(--border)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--sub)' }}>No VS matches yet</p>
            <p className="mt-1 text-xs" style={{ color: 'color-mix(in srgb, var(--sub) 60%, transparent)' }}>Submit a VS match from My Games to get started</p>
          </div>
        ) : (
          <>
            {/* Opponent filter pills */}
            {opponentStats.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
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
                      className="shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all"
                      style={isActive ? { background: 'var(--accent)', color: 'var(--acc-text)' } : {
                        background: 'var(--elevated)', color: 'var(--sub)', border: '1px solid var(--border)',
                      }}
                    >
                      <span
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                        style={isActive ? { background: 'rgba(255,255,255,0.2)' } : { background: 'color-mix(in srgb, var(--sub) 20%, transparent)' }}
                      >
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                      {name.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Overall stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Record" value={recordStr} sub={`${winPct}% win rate`} nowrap />
              <StatCard label="Avg Score" value={avgMyScore || '—'} sub="in VS matches" />
              <StatCard label="Pin Diff" value={totalPinDiff > 0 ? `+${totalPinDiff}` : totalPinDiff}
                sub={total > 0 ? `${totalPinDiff > 0 ? '+' : ''}${Math.round(totalPinDiff / total)} avg/game` : undefined} />
              <StatCard label="Matches" value={total}
                sub={timeFilter === 'all' ? 'all time' : TIME_FILTERS.find(f => f.key === timeFilter)?.label} />
            </div>

            {/* Head-to-head breakdown */}
            {opponentStats.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--text)' }}>HEAD-TO-HEAD</div>
                  {opponentFilter && (
                    <button onClick={() => setOpponentFilter(null)} className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                      Clear filter
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {opponentStats.map(s => (
                    <OpponentCard
                      key={s.profile?.id}
                      stats={s}
                      isActive={opponentFilter === s.profile?.id}
                      onFilter={() => setOpponentFilter(prev => prev === s.profile?.id ? null : s.profile?.id)}
                      statView={getCardView(s.profile?.id)}
                      onStatViewChange={mode => setCardStatView(prev => ({ ...prev, [s.profile?.id]: mode }))}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Match history */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--text)' }}>MATCH HISTORY</div>
                {opponentFilter && (
                  <span className="text-xs font-normal" style={{ color: 'var(--sub)' }}>
                    · vs {activeOpponentName}
                  </span>
                )}
              </div>
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: 'var(--sub)' }}>No matches in this range</p>
              ) : (
                <div className="space-y-4">
                  {matchDateGroups.map(({ date, matches: dayMatches }) => (
                    <div key={date.toDateString()} className="space-y-2">
                      <VSDaySummary matches={dayMatches} opponentName={activeOpponentName} />
                      {dayMatches.map(m => (
                        <MatchRow key={m.id} match={m} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
