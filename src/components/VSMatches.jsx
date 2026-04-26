import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { FrameGrid } from './Scorecard'

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
  const splits = games.reduce((s, g) => s + (g.frames?.filter(f => f?.split).length ?? 0), 0)
  const converted = games.reduce((s, g) => s + (g.frames?.filter(f => f?.split && f?.splitPickedUp).length ?? 0), 0)
  return {
    count,
    totalPins,
    avgScore: count > 0 ? Math.round(totalPins / count) : 0,
    highScore: count > 0 ? Math.max(...scores) : 0,
    lowScore: count > 0 ? Math.min(...scores) : 0,
    strikes: games.reduce((s, g) => s + (g.strikes ?? 0), 0),
    spares: games.reduce((s, g) => s + (g.spares ?? 0), 0),
    opens: games.reduce((s, g) => s + (g.opens ?? 0), 0),
    splits,
    converted,
  }
}

function VSDaySummary({ matches, opponentName }) {
  const myGames = matches.map(m => m.myGame).filter(Boolean)
  const theirGames = matches.map(m => m.theirGame).filter(Boolean)
  const mine = computeDaySummary(myGames)
  const theirs = opponentName ? computeDaySummary(theirGames) : null

  const date = matches[0] ? new Date(matches[0].played_at) : null
  const dateStr = date
    ? date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    : ''

  const statRows = [
    ['Total Pins', mine.totalPins, theirs?.totalPins],
    ['Avg Score',  mine.avgScore,  theirs?.avgScore],
    ['High / Low', `${mine.highScore}/${mine.lowScore}`, theirs ? `${theirs.highScore}/${theirs.lowScore}` : null],
    ['Strikes',   mine.strikes,   theirs?.strikes],
    ['Spares',    mine.spares,    theirs?.spares],
    ['Opens',     mine.opens,     theirs?.opens],
    ['Splits',    mine.splits,    theirs?.splits],
    ['Converted', mine.converted, theirs?.converted],
  ]

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-700">{dateStr}</p>
        <p className="text-xs text-gray-400">{matches.length} match{matches.length !== 1 ? 'es' : ''}</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left font-normal text-gray-400 pb-1 w-20" />
            <th className="text-center font-semibold text-gray-700 pb-1">You</th>
            {theirs && <th className="text-center font-semibold text-gray-700 pb-1">{opponentName}</th>}
          </tr>
        </thead>
        <tbody>
          {statRows.map(([label, myVal, theirVal]) => (
            <tr key={label}>
              <td className="text-gray-500 py-0.5">{label}</td>
              <td className="text-center font-semibold text-gray-800 py-0.5">{myVal}</td>
              {theirs && <td className="text-center font-semibold text-gray-600 py-0.5">{theirVal}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function resultColor(r) {
  if (r === 'W') return 'text-green-600 bg-green-50'
  if (r === 'L') return 'text-red-500 bg-red-50'
  return 'text-gray-500 bg-gray-100'
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-center shadow-sm">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="mt-0.5 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  )
}

function MatchRow({ match, currentUserId }) {
  const [expanded, setExpanded] = useState(false)
  const date = new Date(match.played_at)
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  const oppName = match.opponentProfile?.display_name || match.opponentProfile?.email || 'Opponent'

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {/* Result pill */}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${resultColor(match.result)}`}>
          {match.result}
        </span>

        {/* Scores */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            <span className={match.result === 'W' ? 'text-green-700' : match.result === 'L' ? 'text-red-600' : ''}>
              {match.myGame?.total_score ?? '—'}
            </span>
            <span className="mx-1.5 text-gray-300">vs</span>
            <span className="text-gray-600">{match.theirGame?.total_score ?? '—'}</span>
          </p>
          <p className="text-xs text-gray-400">{oppName} · {dateStr}</p>
        </div>

        {/* Chevron */}
        <svg className={`h-4 w-4 shrink-0 text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && match.myGame?.frames && match.theirGame?.frames && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-3">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">You — {match.myGame.total_score}</p>
            <FrameGrid frames={match.myGame.frames} />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{oppName} — {match.theirGame.total_score}</p>
            <FrameGrid frames={match.theirGame.frames} />
          </div>
        </div>
      )}
    </div>
  )
}

function OpponentCard({ stats, onFilter, isActive }) {
  const name = stats.profile?.display_name || stats.profile?.email || 'Opponent'
  const initials = name.slice(0, 2).toUpperCase()
  const total = stats.w + stats.l + stats.t
  const winPct = total > 0 ? Math.round(stats.w / total * 100) : 0
  const myAvg = total > 0 ? Math.round(stats.myPins / total) : 0
  const oppAvg = total > 0 ? Math.round(stats.oppPins / total) : 0

  // Last 5 results for the trend dots
  const last5 = stats.matches.slice(0, 5).map(m => m.result)

  return (
    <button
      onClick={onFilter}
      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${isActive ? 'border-slate-700 bg-slate-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
          <p className="text-xs text-gray-400">{stats.w}W-{stats.l}L{stats.t > 0 ? `-${stats.t}T` : ''} · {winPct}% win</p>
        </div>
        {isActive && (
          <svg className="h-4 w-4 shrink-0 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Avg: <span className="font-semibold text-gray-800">{myAvg}</span> vs <span className="font-semibold text-gray-600">{oppAvg}</span></span>
        <div className="flex gap-1">
          {last5.map((r, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${r === 'W' ? 'bg-green-400' : r === 'L' ? 'bg-red-400' : 'bg-gray-300'}`}
            />
          ))}
        </div>
      </div>
    </button>
  )
}

export default function VSMatches({ session }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState('all')
  const [opponentFilter, setOpponentFilter] = useState(null)

  useEffect(() => {
    loadVsData()
  }, [])

  async function loadVsData() {
    setLoading(true)
    const userId = session.user.id

    const { data: matchRows } = await supabase
      .from('vs_matches')
      .select('id, submitter_id, opponent_id, submitter_game_id, opponent_game_id, played_at')
      .or(`submitter_id.eq.${userId},opponent_id.eq.${userId}`)
      .order('played_at', { ascending: false })

    if (!matchRows || matchRows.length === 0) {
      setMatches([])
      setLoading(false)
      return
    }

    // Fetch profiles and games in parallel
    const allUserIds = [...new Set(matchRows.flatMap(m => [m.submitter_id, m.opponent_id]))]
    const allGameIds = matchRows.flatMap(m => [m.submitter_game_id, m.opponent_game_id])

    const [profilesRes, gamesRes] = await Promise.all([
      supabase.from('profiles').select('id, display_name, email').in('id', allUserIds),
      supabase.from('games').select('id, user_id, total_score, frames, strikes, spares, opens').in('id', allGameIds),
    ])

    const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]))
    const gameMap = Object.fromEntries((gamesRes.data || []).map(g => [g.id, g]))

    const enriched = matchRows.map(m => {
      const iAmSubmitter = m.submitter_id === userId
      const myGameId = iAmSubmitter ? m.submitter_game_id : m.opponent_game_id
      const theirGameId = iAmSubmitter ? m.opponent_game_id : m.submitter_game_id
      const myGame = gameMap[myGameId]
      const theirGame = gameMap[theirGameId]
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

  // Apply time filter
  const now = new Date()
  const filtered = matches.filter(m => {
    const d = new Date(m.played_at)
    if (timeFilter === 'year') return d.getFullYear() === now.getFullYear()
    if (timeFilter === '3mo') return d >= new Date(now - 90 * 86400000)
    if (timeFilter === '30d') return d >= new Date(now - 30 * 86400000)
    return true
  }).filter(m => !opponentFilter || m.opponentProfile?.id === opponentFilter)

  // Overall stats
  const totalW = filtered.filter(m => m.result === 'W').length
  const totalL = filtered.filter(m => m.result === 'L').length
  const totalT = filtered.filter(m => m.result === 'T').length
  const total = filtered.length
  const winPct = total > 0 ? Math.round(totalW / total * 100) : 0
  const avgMyScore = total > 0 ? Math.round(filtered.reduce((s, m) => s + (m.myGame?.total_score ?? 0), 0) / total) : 0
  const totalPinDiff = filtered.reduce((s, m) => s + ((m.myGame?.total_score ?? 0) - (m.theirGame?.total_score ?? 0)), 0)

  // Per-opponent breakdown (from unfiltered time but respecting time filter, excluding opponent filter)
  const timeFiltered = matches.filter(m => {
    const d = new Date(m.played_at)
    if (timeFilter === 'year') return d.getFullYear() === now.getFullYear()
    if (timeFilter === '3mo') return d >= new Date(now - 90 * 86400000)
    if (timeFilter === '30d') return d >= new Date(now - 30 * 86400000)
    return true
  })

  const byOpponent = {}
  timeFiltered.forEach(m => {
    const key = m.opponentProfile?.id
    if (!key) return
    if (!byOpponent[key]) byOpponent[key] = { profile: m.opponentProfile, w: 0, l: 0, t: 0, myPins: 0, oppPins: 0, matches: [] }
    const b = byOpponent[key]
    if (m.result === 'W') b.w++
    else if (m.result === 'L') b.l++
    else b.t++
    b.myPins += m.myGame?.total_score ?? 0
    b.oppPins += m.theirGame?.total_score ?? 0
    b.matches.push(m)
  })
  const opponentStats = Object.values(byOpponent).sort((a, b) => (b.w + b.l + b.t) - (a.w + a.l + a.t))

  const activeOpponentName = opponentFilter
    ? (opponentStats.find(s => s.profile?.id === opponentFilter)?.profile?.display_name ||
       opponentStats.find(s => s.profile?.id === opponentFilter)?.profile?.email ||
       'Opponent')
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
    return <div className="flex justify-center py-16 text-sm text-gray-400">Loading VS history…</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">VS Matches</h2>
        <p className="mt-1 text-sm text-gray-500">
          {matches.length === 0 ? 'No VS matches yet' : `${matches.length} match${matches.length !== 1 ? 'es' : ''} total`}
        </p>
      </div>

      {matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16">
          <p className="text-sm font-medium text-gray-400">No VS matches yet</p>
          <p className="mt-1 text-xs text-gray-300">Submit a VS match from My Games to get started</p>
        </div>
      ) : (
        <>
          {/* Time filter */}
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
            {TIME_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => { setTimeFilter(f.key); setOpponentFilter(null) }}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors
                  ${timeFilter === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Friend filter pills */}
          {opponentStats.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
              <button
                onClick={() => setOpponentFilter(null)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors
                  ${!opponentFilter ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
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
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors
                      ${isActive ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold
                      ${isActive ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-700'}`}>
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                    {name.split(' ')[0]}
                  </button>
                )
              })}
            </div>
          )}

          {/* Overall stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Record"
              value={recordStr}
              sub={`${winPct}% win rate`}
            />
            <StatCard
              label="Avg Score"
              value={avgMyScore || '—'}
              sub="in VS matches"
            />
            <StatCard
              label="Pin Diff"
              value={totalPinDiff > 0 ? `+${totalPinDiff}` : totalPinDiff}
              sub={total > 0 ? `${totalPinDiff > 0 ? '+' : ''}${total > 0 ? Math.round(totalPinDiff / total) : 0} avg/game` : undefined}
            />
            <StatCard
              label="Matches"
              value={total}
              sub={timeFilter === 'all' ? 'all time' : TIME_FILTERS.find(f => f.key === timeFilter)?.label}
            />
          </div>

          {/* Per-opponent breakdown */}
          {opponentStats.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Head-to-Head</h3>
                {opponentFilter && (
                  <button
                    onClick={() => setOpponentFilter(null)}
                    className="text-xs text-slate-600 hover:text-slate-800 font-medium"
                  >
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
                  />
                ))}
              </div>
            </div>
          )}

          {/* Match history */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              Match History
              {opponentFilter && (
                <span className="ml-1 font-normal text-gray-400">
                  · vs {opponentStats.find(s => s.profile?.id === opponentFilter)?.profile?.display_name ||
                        opponentStats.find(s => s.profile?.id === opponentFilter)?.profile?.email}
                </span>
              )}
            </h3>
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No matches in this range</p>
            ) : (
              <div className="space-y-4">
                {matchDateGroups.map(({ date, matches: dayMatches }) => (
                  <div key={date.toDateString()} className="space-y-2">
                    <VSDaySummary matches={dayMatches} opponentName={activeOpponentName} />
                    {dayMatches.map(m => (
                      <MatchRow key={m.id} match={m} currentUserId={session.user.id} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
