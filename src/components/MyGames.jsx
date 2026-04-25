import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { parseScorecard } from '../lib/gemini'
import { computeStats } from '../lib/parseGame'

// ── Scorecard frame grid ─────────────────────────────────────────────────────

function BallMark({ value }) {
  if (value === 'X') return <span className="font-bold text-red-500">X</span>
  if (value === '/') return <span className="font-bold text-blue-500">/</span>
  if (value === '-') return <span className="text-gray-400">-</span>
  return <span className="text-gray-700">{value}</span>
}

function FrameGrid({ frames }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <div className="flex min-w-max">
        {frames.map((frame) => {
          const isTenth = frame.frame === 10
          return (
            <div
              key={frame.frame}
              className={`flex flex-col border-r border-gray-100 last:border-r-0 text-center ${isTenth ? 'w-[4.5rem]' : 'w-10'}`}
            >
              <div className="border-b border-gray-100 py-0.5 text-[10px] font-medium text-gray-400">
                {frame.frame}
              </div>
              <div className="flex h-7 items-center justify-end gap-0.5 border-b border-gray-100 px-1 text-xs">
                {isTenth
                  ? frame.balls.map((b, i) => <BallMark key={i} value={b} />)
                  : frame.balls[0] === 'X'
                  ? <BallMark value="X" />
                  : <>
                      <BallMark value={frame.balls[0] ?? ''} />
                      {frame.balls[1] != null && <BallMark value={frame.balls[1]} />}
                    </>
                }
              </div>
              <div className="py-1.5 text-xs font-semibold text-gray-800">
                {frame.runningScore}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Game card ────────────────────────────────────────────────────────────────

function GameCard({ game, expanded, onToggle }) {
  const date = new Date(game.played_at)
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 text-base font-bold text-white">
          {game.total_score}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-800">
            {game.strikes} strikes · {game.spares} spares · {game.opens} open
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
            <span>Initial run: {game.initial_run}</span>
            <span>·</span>
            <span>{timeStr}</span>
            {game.player_label && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
                {game.player_label}
              </span>
            )}
          </div>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3">
          <FrameGrid frames={game.frames} />
        </div>
      )}
    </div>
  )
}

// ── Day group ────────────────────────────────────────────────────────────────

function DayGroup({ date, games, expandedGames, onToggleGame }) {
  const [collapsed, setCollapsed] = useState(false)

  const today = new Date()
  const isToday = today.toDateString() === date.toDateString()
  const label = isToday
    ? 'Today'
    : date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-2">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {label}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
          {games.length}
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-2 pl-4">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              expanded={expandedGames.has(game.id)}
              onToggle={() => onToggleGame(game.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({ session, profile, onClose, onSaved }) {
  const [phase, setPhase] = useState('input')
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [playerLabel, setPlayerLabel] = useState(profile?.player_label ?? '')
  const [playedAt, setPlayedAt] = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  })
  const [parsedData, setParsedData] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setError(null)
    setParsedData(null)
    setPhase('input')
  }

  async function handleParse() {
    if (!imageFile) { setError('Select a photo first.'); return }
    if (!playerLabel.trim()) { setError('Enter the player label shown on the screen (e.g. "A").'); return }

    setPhase('parsing')
    setError(null)

    try {
      const result = await parseScorecard(imageFile, playerLabel.trim())

      if (!result.found) {
        setError(result.error || `Could not find player "${playerLabel}" in the photo.`)
        setPhase('input')
        return
      }

      setParsedData({ ...result, ...computeStats(result.frames) })
      setPhase('review')
    } catch (err) {
      setError(err.message || 'Failed to parse photo.')
      setPhase('input')
    }
  }

  async function handleSave() {
    setPhase('saving')

    if (playerLabel !== profile?.player_label) {
      await supabase
        .from('profiles')
        .update({ player_label: playerLabel.trim() })
        .eq('id', session.user.id)
    }

    const { data, error: saveErr } = await supabase
      .from('games')
      .insert({
        user_id: session.user.id,
        played_at: new Date(playedAt).toISOString(),
        total_score: parsedData.totalScore,
        player_label: playerLabel.trim(),
        strikes: parsedData.strikes,
        spares: parsedData.spares,
        opens: parsedData.opens,
        initial_run: parsedData.initialRun,
        frames: parsedData.frames,
      })
      .select()
      .single()

    if (saveErr) {
      setError('Failed to save. ' + saveErr.message)
      setPhase('review')
      return
    }

    onSaved(data)
    onClose()
  }

  const isParsing = phase === 'parsing'
  const isSaving = phase === 'saving'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Upload Game</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Photo picker */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors
            ${previewUrl ? 'border-transparent' : 'border-gray-200 py-8 hover:border-slate-400'}`}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Scorecard preview" className="h-40 w-full rounded-xl object-cover" />
          ) : (
            <>
              <svg className="mb-2 h-8 w-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <p className="text-sm font-medium text-gray-500">Tap to take photo or upload</p>
              <p className="mt-0.5 text-xs text-gray-400">Photo is not stored after parsing</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Fields */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Your label on screen</label>
            <input
              type="text"
              value={playerLabel}
              onChange={(e) => setPlayerLabel(e.target.value.toUpperCase())}
              placeholder="A"
              maxLength={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono uppercase outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Date &amp; time played</label>
            <input
              type="datetime-local"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>
        )}

        {/* Parsed preview */}
        {phase === 'review' && parsedData && (
          <div className="mb-3 rounded-xl bg-slate-50 p-3">
            <div className="mb-2 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-bold text-slate-900">{parsedData.totalScore}</span>
                <span className="ml-1.5 text-sm text-slate-500">total</span>
              </div>
              <div className="text-right text-xs text-slate-600">
                <div>{parsedData.strikes} strikes · {parsedData.spares} spares · {parsedData.opens} open</div>
                <div>Initial run: {parsedData.initialRun}</div>
              </div>
            </div>
            <FrameGrid frames={parsedData.frames} />
          </div>
        )}

        {/* Actions */}
        {phase !== 'review' ? (
          <button
            onClick={handleParse}
            disabled={isParsing || isSaving}
            className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {isParsing ? 'Parsing photo…' : 'Parse Score'}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setPhase('input')}
              disabled={isSaving}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Retake
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving…' : 'Save Game'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function MyGames({ session }) {
  const [games, setGames] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [expandedGames, setExpandedGames] = useState(new Set())

  useEffect(() => {
    Promise.all([loadGames(), loadProfile()])
  }, [])

  async function loadGames() {
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', session.user.id)
      .order('played_at', { ascending: false })
    setGames(data || [])
    setLoading(false)
  }

  async function loadProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('player_label')
      .eq('id', session.user.id)
      .single()
    setProfile(data)
  }

  function toggleGame(id) {
    setExpandedGames((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleGameSaved(newGame) {
    setGames((prev) => [newGame, ...prev])
  }

  const gamesByDay = games.reduce((acc, game) => {
    const key = new Date(game.played_at).toDateString()
    if (!acc[key]) acc[key] = { date: new Date(game.played_at), games: [] }
    acc[key].games.push(game)
    return acc
  }, {})

  const days = Object.values(gamesByDay).sort((a, b) => b.date - a.date)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">My Games</h2>
          <p className="mt-1 text-sm text-gray-500">
            {loading ? 'Loading…' : games.length === 0 ? 'No games yet' : `${games.length} game${games.length !== 1 ? 's' : ''} recorded`}
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Upload Game
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-sm text-gray-400">Loading games…</div>
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16">
          <p className="text-sm font-medium text-gray-400">No games recorded yet</p>
          <p className="mt-1 text-xs text-gray-300">Upload a photo of your scorecard to get started</p>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map(({ date, games: dayGames }) => (
            <DayGroup
              key={date.toDateString()}
              date={date}
              games={dayGames}
              expandedGames={expandedGames}
              onToggleGame={toggleGame}
            />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          session={session}
          profile={profile}
          onClose={() => setShowUpload(false)}
          onSaved={handleGameSaved}
        />
      )}
    </div>
  )
}
