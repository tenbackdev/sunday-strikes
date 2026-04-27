import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { parseScorecard } from '../lib/gemini'
import { computeStats, computeScores } from '../lib/parseGame'
import { BallMark, EditableBallInput, StatTable, FrameGrid, EditableFrameGrid } from './Scorecard'


// ── Day summary helper ───────────────────────────────────────────────────────

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

function DaySummary({ games }) {
  const s = computeDaySummary(games)
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-gray-500">
        <span><span className="font-semibold text-gray-700">{s.count}</span> game{s.count !== 1 ? 's' : ''}</span>
        <span className="text-gray-200">·</span>
        {s.count > 1 ? (
          <>
            <span>Avg <span className="font-semibold text-gray-700">{s.avgScore}</span></span>
            <span className="text-gray-200">·</span>
            <span>Hi <span className="font-semibold text-gray-700">{s.highScore}</span></span>
            <span className="text-gray-200">·</span>
            <span>Lo <span className="font-semibold text-gray-700">{s.lowScore}</span></span>
            <span className="text-gray-200">·</span>
            <span>Pins <span className="font-semibold text-gray-700">{s.totalPins}</span></span>
          </>
        ) : (
          <span>Score <span className="font-semibold text-gray-700">{s.totalPins}</span></span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
        <span><span className="font-bold text-red-400">X</span> <span className="font-semibold text-gray-700">{s.strikes}</span></span>
        <span><span className="font-bold text-blue-400">/</span> <span className="font-semibold text-gray-700">{s.spares}</span></span>
        <span><span className="font-medium text-gray-400">-</span> <span className="font-semibold text-gray-700">{s.opens}</span></span>
        <span><span className="font-medium text-gray-500">S</span> <span className="font-semibold text-gray-700">{s.splits}</span></span>
        <span><span className="font-medium text-gray-500">S/</span> <span className="font-semibold text-gray-700">{s.converted}</span></span>
      </div>
    </div>
  )
}

// ── Game card ────────────────────────────────────────────────────────────────

function GameCard({ game, expanded, onToggle, onEdit, onDelete, vsResult }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const date = new Date(game.played_at)
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  function handleDelete(e) {
    e.stopPropagation()
    if (!confirmDelete) { setConfirmDelete(true); return }
    onDelete(game.id)
  }

  function handleEdit(e) {
    e.stopPropagation()
    setConfirmDelete(false)
    onEdit(game)
  }

  function handleCancelDelete(e) {
    e.stopPropagation()
    setConfirmDelete(false)
  }

  const vsAccent = vsResult
    ? vsResult.result === 'W' ? 'border-l-4 border-l-green-400'
    : vsResult.result === 'L' ? 'border-l-4 border-l-red-400'
    : 'border-l-4 border-l-gray-300'
    : ''

  return (
    <div className={`overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm min-w-[300px] ${vsAccent}`}>
      <div className="flex w-full items-center gap-3 px-4 py-3">
        {/* Score bubble */}
        <button onClick={onToggle} className="flex shrink-0 items-center justify-center rounded-full bg-slate-900 h-12 w-12 text-base font-bold text-white">
          {game.total_score}
        </button>

        {/* Stat table + meta */}
        <button onClick={onToggle} className="flex-1 min-w-0 text-left">
          {vsResult && (
            <div className={`mb-1.5 flex items-center gap-1.5`}>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide
                ${vsResult.result === 'W' ? 'bg-green-100 text-green-700' :
                  vsResult.result === 'L' ? 'bg-red-100 text-red-600' :
                  'bg-gray-100 text-gray-500'}`}>
                {vsResult.result === 'W' ? 'WIN' : vsResult.result === 'L' ? 'LOSS' : 'TIE'}
              </span>
              <span className="text-xs font-medium text-gray-500">vs {vsResult.opponentName}</span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{vsResult.oppScore}</span>
            </div>
          )}
          <StatTable
            strikes={game.strikes}
            spares={game.spares}
            opens={game.opens}
            initialRun={game.initial_run}
            frames={game.frames}
          />
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400 flex-wrap">
            <span>{timeStr}</span>
            {game.player_label && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
                {game.player_label}
              </span>
            )}
            {game.ai_frames && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-500">edited</span>
            )}
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {confirmDelete ? (
            <>
              <button
                onClick={handleDelete}
                className="rounded-lg bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={handleCancelDelete}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={handleEdit} title="Edit game" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button onClick={handleDelete} title="Delete game" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
              <button onClick={onToggle} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
                <svg className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3">
          <FrameGrid frames={game.frames} />
        </div>
      )}
    </div>
  )
}

// ── Day group ────────────────────────────────────────────────────────────────

function DayGroup({ date, games, expandedGames, onToggleGame, onEditGame, onDeleteGame, defaultCollapsed = false, getVsResult }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [showSummary, setShowSummary] = useState(false)
  const today = new Date()
  const isToday = today.toDateString() === date.toDateString()
  const label = isToday
    ? 'Today'
    : date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  // Compute per-opponent VS summaries for this day
  const vsSummaries = (() => {
    const byOpponent = {}
    games.forEach(game => {
      const r = getVsResult?.(game)
      if (!r) return
      const key = r.opponentId
      if (!byOpponent[key]) byOpponent[key] = { name: r.opponentName, w: 0, l: 0, t: 0, myPins: 0, oppPins: 0 }
      const s = byOpponent[key]
      if (r.result === 'W') s.w++
      else if (r.result === 'L') s.l++
      else s.t++
      s.myPins += r.myScore
      s.oppPins += r.oppScore
    })
    return Object.values(byOpponent)
  })()

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className={`h-3.5 w-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {label}
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{games.length}</span>
        </button>
        <button
          onClick={() => setShowSummary(s => !s)}
          className={`flex items-center gap-1 text-xs transition-colors ${showSummary ? 'text-slate-600 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Summary
          <svg className={`h-3 w-3 transition-transform ${showSummary ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {showSummary && <DaySummary games={games} />}

      {!collapsed && (
        <div className="pl-4 space-y-2">
          {vsSummaries.map(s => (
            <p key={s.name} className="text-xs text-gray-500">
              <span className="font-medium text-gray-600">vs {s.name}</span>
              {' — '}
              <span className="font-semibold text-gray-700">
                {s.w}W-{s.l}L{s.t > 0 ? `-${s.t}T` : ''}
              </span>
              <span className="text-gray-400"> · {s.myPins}-{s.oppPins} pins</span>
            </p>
          ))}
          <div className="space-y-2">
            {games.map(game => (
              <GameCard
                key={game.id}
                game={game}
                expanded={expandedGames.has(game.id)}
                onToggle={() => onToggleGame(game.id)}
                onEdit={onEditGame}
                onDelete={onDeleteGame}
                vsResult={getVsResult?.(game)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Month group ──────────────────────────────────────────────────────────────

function MonthGroup({ label, dayGroups, expandedGames, onToggleGame, onEditGame, onDeleteGame, getVsResult }) {
  const [collapsed, setCollapsed] = useState(true)
  const totalGames = dayGroups.reduce((sum, d) => sum + d.games.length, 0)

  return (
    <div className="space-y-2">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
      >
        <svg className={`h-3.5 w-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {label}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">{totalGames}</span>
      </button>

      {!collapsed && (
        <div className="space-y-4 pl-4">
          {dayGroups.map(({ date, games: dayGames }) => (
            <DayGroup
              key={date.toDateString()}
              date={date}
              games={dayGames}
              expandedGames={expandedGames}
              onToggleGame={onToggleGame}
              onEditGame={onEditGame}
              onDeleteGame={onDeleteGame}
              getVsResult={getVsResult}
              defaultCollapsed={true}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Upload modal (new game) ──────────────────────────────────────────────────

export function UploadModal({ session, profile, onClose, onSaved }) {
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
  const [aiFrames, setAiFrames] = useState(null)
  const [error, setError] = useState(null)

  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setError(null)
    setParsedData(null)
    setAiFrames(null)
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

      const scoredFrames = computeScores(result.frames)
      const stats = computeStats(scoredFrames)
      setAiFrames(JSON.parse(JSON.stringify(scoredFrames)))
      setParsedData({ frames: scoredFrames, ...stats })
      setPhase('review')
    } catch (err) {
      setError(err.message || 'Failed to parse photo.')
      setPhase('input')
    }
  }

  function handleFramesChange(newFrames) {
    const scored = computeScores(newFrames)
    const stats = computeStats(scored)
    setParsedData({ frames: scored, ...stats })
  }

  async function handleSave() {
    const totalScore = parsedData.frames[9]?.runningScore ?? 0
    if (totalScore < 0 || totalScore > 300) {
      setError('Computed score is out of range (0–300). Check your frame entries.')
      return
    }

    setPhase('saving')

    if (playerLabel !== profile?.player_label) {
      await supabase
        .from('profiles')
        .update({ player_label: playerLabel.trim() })
        .eq('id', session.user.id)
    }

    const framesEdited = JSON.stringify(parsedData.frames) !== JSON.stringify(aiFrames)

    const { data, error: saveErr } = await supabase
      .from('games')
      .insert({
        user_id: session.user.id,
        played_at: new Date(playedAt).toISOString(),
        total_score: totalScore,
        player_label: playerLabel.trim(),
        strikes: parsedData.strikes,
        spares: parsedData.spares,
        opens: parsedData.opens,
        initial_run: parsedData.initialRun,
        frames: parsedData.frames,
        ...(framesEdited ? { ai_frames: aiFrames } : {}),
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
  const isReview = phase === 'review'
  const totalScore = parsedData?.frames[9]?.runningScore ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Upload Game</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Photo area */}
        {previewUrl ? (
          <div className="relative mb-4">
            <img src={previewUrl} alt="Scorecard preview" className="h-40 w-full rounded-xl object-cover" />
            <button
              onClick={() => { setPreviewUrl(null); setImageFile(null); setPhase('input'); setParsedData(null) }}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-5 hover:border-slate-400 transition-colors"
            >
              <svg className="h-7 w-7 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className="text-xs font-medium text-gray-500">Take Photo</span>
            </button>
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-5 hover:border-slate-400 transition-colors"
            >
              <svg className="h-7 w-7 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span className="text-xs font-medium text-gray-500">Choose Photo</span>
            </button>
          </div>
        )}

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
        <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Your label on screen</label>
            <input
              type="text"
              value={playerLabel}
              onChange={e => setPlayerLabel(e.target.value.toUpperCase())}
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
              onChange={e => setPlayedAt(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}

        {isReview && parsedData && (
          <div className="mb-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">Review &amp; edit before saving</span>
              <span className="text-[10px] text-gray-400">Tap any ball to edit</span>
            </div>
            <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900">{totalScore}</span>
                <span className="text-sm text-slate-500">total</span>
              </div>
              <StatTable
                strikes={parsedData.strikes}
                spares={parsedData.spares}
                opens={parsedData.opens}
                initialRun={parsedData.initialRun}
                frames={parsedData.frames}
              />
            </div>
            <EditableFrameGrid frames={parsedData.frames} onChange={handleFramesChange} />
          </div>
        )}

        {!isReview ? (
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

// ── Edit game modal ──────────────────────────────────────────────────────────

function EditGameModal({ game, session, onClose, onSaved }) {
  const [frames, setFrames] = useState(() => computeScores(JSON.parse(JSON.stringify(game.frames))))
  const [playerLabel, setPlayerLabel] = useState(game.player_label ?? '')
  const [playedAt, setPlayedAt] = useState(() => {
    const d = new Date(game.played_at)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const stats = computeStats(frames)
  const totalScore = frames[9]?.runningScore ?? 0

  function handleFramesChange(newFrames) {
    setFrames(computeScores(newFrames))
  }

  async function handleSave() {
    if (totalScore < 0 || totalScore > 300) {
      setError('Computed score is out of range (0–300). Check your frame entries.')
      return
    }

    setSaving(true)
    setError(null)

    const originalFrames = JSON.parse(JSON.stringify(game.frames))
    const framesChanged = JSON.stringify(frames) !== JSON.stringify(originalFrames)
    const shouldSetAiFrames = framesChanged && !game.ai_frames

    const updates = {
      played_at: new Date(playedAt).toISOString(),
      total_score: totalScore,
      player_label: playerLabel.trim(),
      strikes: stats.strikes,
      spares: stats.spares,
      opens: stats.opens,
      initial_run: stats.initialRun,
      frames,
      ...(shouldSetAiFrames ? { ai_frames: originalFrames } : {}),
    }

    const { data: savedGame, error: saveErr } = await supabase
      .from('games')
      .update(updates)
      .eq('id', game.id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (saveErr) {
      setError('Failed to save. ' + saveErr.message)
      setSaving(false)
      return
    }

    if (!savedGame) {
      setError('Save failed — game not found or permission denied.')
      setSaving(false)
      return
    }

    onSaved(savedGame)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Edit Game</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Score + stats summary */}
        <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{totalScore}</span>
            <span className="text-sm text-slate-500">total</span>
          </div>
          <StatTable
            strikes={stats.strikes}
            spares={stats.spares}
            opens={stats.opens}
            initialRun={stats.initialRun}
            frames={frames}
          />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Player label</label>
            <input
              type="text"
              value={playerLabel}
              onChange={e => setPlayerLabel(e.target.value.toUpperCase())}
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
              onChange={e => setPlayedAt(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        <div className="mb-3">
          <p className="mb-2 text-xs font-semibold text-gray-700">Frames <span className="font-normal text-gray-400">(scores update automatically)</span></p>
          <EditableFrameGrid frames={frames} onChange={handleFramesChange} />
        </div>

        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Legend popover ───────────────────────────────────────────────────────────

function LegendPopover({ onClose }) {
  const rows = [
    { symbol: 'X',  cls: 'font-bold text-red-500',  label: 'Strikes' },
    { symbol: '/',  cls: 'font-bold text-blue-500', label: 'Spares' },
    { symbol: '-',  cls: 'text-gray-400',           label: 'Opens' },
    { symbol: '#',  cls: 'text-gray-600',           label: 'Strikes to Start' },
    { symbol: 'S',  cls: 'text-gray-600',           label: 'Splits' },
    { symbol: 'S/', cls: 'text-gray-600',           label: 'Converted Splits' },
  ]
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-xl border border-gray-100 bg-white p-4 shadow-xl">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Summary Legend</p>
        <div className="space-y-2.5">
          {rows.map(r => (
            <div key={r.symbol} className="flex items-center gap-3">
              <span className={`w-6 shrink-0 text-center text-sm ${r.cls}`}>{r.symbol}</span>
              <span className="text-xs font-semibold text-gray-700">{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function MyGames({ session, refreshKey = 0, onOpenUpload }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingGame, setEditingGame] = useState(null)
  const [expandedGames, setExpandedGames] = useState(new Set())
  const [showLegend, setShowLegend] = useState(false)
  const [vsMatchMap, setVsMatchMap] = useState({})
  const [vsOpponentGameMap, setVsOpponentGameMap] = useState({})

  useEffect(() => {
    loadGamesAndVsData()
  }, [refreshKey])

  async function loadGamesAndVsData() {
    const { data: gamesData } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', session.user.id)
      .order('played_at', { ascending: false })

    const allGames = gamesData || []
    setGames(allGames)
    setLoading(false)

    const vsMatchIds = [...new Set(
      allGames.filter(g => g.is_vs && g.vs_match_id).map(g => g.vs_match_id)
    )]
    if (vsMatchIds.length === 0) return

    const { data: vsData } = await supabase
      .from('vs_matches')
      .select('id, submitter_id, opponent_id, submitter_game_id, opponent_game_id')
      .in('id', vsMatchIds)

    const matchMap = {}
    vsData?.forEach(m => { matchMap[m.id] = m })
    setVsMatchMap(matchMap)

    // Fetch opponent profiles and game scores in parallel
    const opponentIds = [...new Set(
      Object.values(matchMap).map(m =>
        m.submitter_id === session.user.id ? m.opponent_id : m.submitter_id
      )
    )]
    const opponentGameIds = allGames
      .filter(g => g.is_vs && g.vs_match_id && matchMap[g.vs_match_id])
      .map(g => {
        const m = matchMap[g.vs_match_id]
        return g.user_id === m.submitter_id ? m.opponent_game_id : m.submitter_game_id
      })
      .filter(Boolean)

    const [profilesRes, oppGamesRes] = await Promise.all([
      opponentIds.length > 0
        ? supabase.from('profiles').select('id, display_name, email').in('id', opponentIds)
        : Promise.resolve({ data: [] }),
      opponentGameIds.length > 0
        ? supabase.from('games').select('id, user_id, total_score').in('id', opponentGameIds)
        : Promise.resolve({ data: [] }),
    ])

    const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]))
    // Attach profiles to match map entries for use in getVsResult
    Object.values(matchMap).forEach(m => {
      m.submitterProfile = profileMap[m.submitter_id] ?? { id: m.submitter_id }
      m.opponentProfile = profileMap[m.opponent_id] ?? { id: m.opponent_id }
    })
    setVsMatchMap({ ...matchMap })

    const oppMap = {}
    oppGamesRes.data?.forEach(g => { oppMap[g.id] = g })
    setVsOpponentGameMap(oppMap)
  }

  function getVsResult(game) {
    if (!game.is_vs || !game.vs_match_id) return null
    const match = vsMatchMap[game.vs_match_id]
    if (!match) return null
    const isSubmitter = game.user_id === match.submitter_id
    const opponentGameId = isSubmitter ? match.opponent_game_id : match.submitter_game_id
    const opponentProfile = isSubmitter ? match.opponentProfile : match.submitterProfile
    const oppGame = vsOpponentGameMap[opponentGameId]
    if (!oppGame) return null
    const oppName = opponentProfile?.display_name || opponentProfile?.email || 'Opponent'
    const result = game.total_score > oppGame.total_score ? 'W' :
                   game.total_score < oppGame.total_score ? 'L' : 'T'
    return { result, opponentName: oppName, opponentId: opponentProfile?.id, myScore: game.total_score, oppScore: oppGame.total_score }
  }

  function toggleGame(id) {
    setExpandedGames(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleGameUpdated(updatedGame) {
    setGames(prev => prev.map(g => g.id === updatedGame.id ? updatedGame : g))
  }

  async function handleDeleteGame(id) {
    // The trg_vs_game_delete trigger handles VS match cleanup automatically
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (!error) {
      setGames(prev => prev.filter(g => g.id !== id))
      setExpandedGames(prev => { const next = new Set(prev); next.delete(id); return next })
      // Reload VS data since a match may have been dissolved
      loadGamesAndVsData()
    }
  }

  // Group games by day then by month
  const today = new Date()
  const thisMonthKey = `${today.getFullYear()}-${today.getMonth()}`

  const gamesByDay = games.reduce((acc, game) => {
    const key = new Date(game.played_at).toDateString()
    if (!acc[key]) acc[key] = { date: new Date(game.played_at), games: [] }
    acc[key].games.push(game)
    return acc
  }, {})

  const allDays = Object.values(gamesByDay).sort((a, b) => b.date - a.date)

  const gamesByMonth = allDays.reduce((acc, dayGroup) => {
    const d = dayGroup.date
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!acc[key]) {
      const label = d.toLocaleDateString([], { month: 'long', year: 'numeric' })
      acc[key] = { key, label, date: d, dayGroups: [] }
    }
    acc[key].dayGroups.push(dayGroup)
    return acc
  }, {})

  const months = Object.values(gamesByMonth).sort((a, b) => b.date - a.date)

  const sharedProps = { expandedGames, onToggleGame: toggleGame, onEditGame: setEditingGame, onDeleteGame: handleDeleteGame, getVsResult }

  return (
    <div className="space-y-6">
      <div>
        <div className="relative">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">My Games</h2>
            <button
              onClick={() => setShowLegend(v => !v)}
              title="Score summary legend"
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold transition-colors
                ${showLegend
                  ? 'border-slate-400 bg-slate-800 text-white'
                  : 'border-gray-300 text-gray-400 hover:border-slate-400 hover:text-slate-600'}`}
            >
              ?
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {loading ? 'Loading…' : games.length === 0 ? 'No games yet' : `${games.length} game${games.length !== 1 ? 's' : ''} recorded`}
          </p>
          {showLegend && <LegendPopover onClose={() => setShowLegend(false)} />}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-sm text-gray-400">Loading games…</div>
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16">
          <p className="text-sm font-medium text-gray-400">No games recorded yet</p>
          <p className="mt-1 text-xs text-gray-300">Upload a photo of your scorecard to get started</p>
          {onOpenUpload && (
            <button
              onClick={onOpenUpload}
              className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
            >
              Upload your first game
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {months.map(({ key, label, dayGroups }) => {
            const isCurrentMonth = key === thisMonthKey
            if (isCurrentMonth) {
              return dayGroups.map(({ date, games: dayGames }) => (
                <DayGroup
                  key={date.toDateString()}
                  date={date}
                  games={dayGames}
                  defaultCollapsed={date.toDateString() !== today.toDateString()}
                  {...sharedProps}
                />
              ))
            }
            return (
              <MonthGroup
                key={key}
                label={label}
                dayGroups={dayGroups}
                {...sharedProps}
              />
            )
          })}
        </div>
      )}

      {editingGame && (
        <EditGameModal
          game={editingGame}
          session={session}
          onClose={() => setEditingGame(null)}
          onSaved={game => { handleGameUpdated(game); setEditingGame(null) }}
        />
      )}
    </div>
  )
}
