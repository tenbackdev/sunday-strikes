import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { parseScorecard, parseBothScorecards } from '../lib/gemini'
import { computeStats, computeScores } from '../lib/parseGame'
import { StatTable, FrameGrid, EditableFrameGrid } from './Scorecard'
import { loadUploadPrefs, saveUploadPrefs } from '../lib/uploadPrefs'

function defaultPlayedAt() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

function ScorecardStep({ title, playerLabel, setPlayerLabel, imageFile, setImageFile, parsedData, setParsedData, aiFrames, setAiFrames, phase, setPhase, error, setError, labelPlaceholder }) {
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState(null)

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
    if (!playerLabel.trim()) { setError('Enter the label shown on screen for this player.'); return }
    setPhase('parsing')
    setError(null)
    try {
      const result = await parseScorecard(imageFile, playerLabel.trim())
      if (!result.found) {
        setError(result.error || `Could not find player "${playerLabel}" in the photo.`)
        setPhase('input')
        return
      }
      const scored = computeScores(result.frames)
      const stats = computeStats(scored)
      setAiFrames(JSON.parse(JSON.stringify(scored)))
      setParsedData({ frames: scored, ...stats })
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

  const isParsing = phase === 'parsing'
  const isReview = phase === 'review'
  const totalScore = parsedData?.frames[9]?.runningScore ?? 0

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-gray-700">{title}</p>

      {previewUrl ? (
        <div className="relative mb-3">
          <img src={previewUrl} alt="Scorecard" className="h-36 w-full rounded-xl object-cover" />
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
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-4 hover:border-slate-400 transition-colors"
          >
            <svg className="h-6 w-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className="text-xs font-medium text-gray-500">Take Photo</span>
          </button>
          <button
            onClick={() => galleryRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-4 hover:border-slate-400 transition-colors"
          >
            <svg className="h-6 w-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="text-xs font-medium text-gray-500">Choose Photo</span>
          </button>
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-gray-600">Player label on screen</label>
        <input
          type="text"
          value={playerLabel}
          onChange={e => setPlayerLabel(e.target.value.toUpperCase())}
          placeholder={labelPlaceholder ?? 'A'}
          maxLength={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono uppercase outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}

      {isReview && parsedData && (
        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
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
          disabled={isParsing || !imageFile}
          className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {isParsing ? 'Parsing photo…' : 'Parse Score'}
        </button>
      ) : (
        <button
          onClick={() => { setPhase('input'); setParsedData(null); setPreviewUrl(null); setImageFile(null) }}
          className="w-full rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Retake Photo
        </button>
      )}
    </div>
  )
}

function CombinedScorecardStep({
  myPlayerLabel, setMyPlayerLabel, myParsedData, setMyParsedData, setMyAiFrames,
  oppPlayerLabel, setOppPlayerLabel, oppParsedData, setOppParsedData, setOppAiFrames,
  phase, setPhase, error, setError,
}) {
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setError(null)
    setMyParsedData(null)
    setOppParsedData(null)
    setPhase('input')
  }

  async function handleParse() {
    if (!imageFile) { setError('Select a photo first.'); return }
    if (!myPlayerLabel.trim()) { setError('Enter your player label (e.g. "A").'); return }
    if (!oppPlayerLabel.trim()) { setError('Enter the opponent\'s player label (e.g. "B").'); return }
    if (myPlayerLabel.trim().toUpperCase() === oppPlayerLabel.trim().toUpperCase()) {
      setError('Player labels must be different.')
      return
    }

    setPhase('parsing')
    setError(null)

    try {
      const result = await parseBothScorecards(imageFile, myPlayerLabel.trim(), oppPlayerLabel.trim())
      const players = result?.players ?? []
      const myRaw = players.find(p => p.label?.toUpperCase() === myPlayerLabel.trim().toUpperCase())
      const oppRaw = players.find(p => p.label?.toUpperCase() === oppPlayerLabel.trim().toUpperCase())

      if (!myRaw?.found) {
        setError(`Could not find player "${myPlayerLabel}" in the photo.`)
        setPhase('input')
        return
      }
      if (!oppRaw?.found) {
        setError(`Could not find player "${oppPlayerLabel}" in the photo.`)
        setPhase('input')
        return
      }

      const myScored = computeScores(myRaw.frames)
      const myStats = computeStats(myScored)
      setMyAiFrames(JSON.parse(JSON.stringify(myScored)))
      setMyParsedData({ frames: myScored, ...myStats })

      const oppScored = computeScores(oppRaw.frames)
      const oppStats = computeStats(oppScored)
      setOppAiFrames(JSON.parse(JSON.stringify(oppScored)))
      setOppParsedData({ frames: oppScored, ...oppStats })

      setPhase('review')
    } catch (err) {
      setError(err.message || 'Failed to parse photo.')
      setPhase('input')
    }
  }

  function handleMyFramesChange(newFrames) {
    const scored = computeScores(newFrames)
    setMyParsedData(prev => ({ ...prev, frames: scored, ...computeStats(scored) }))
  }

  function handleOppFramesChange(newFrames) {
    const scored = computeScores(newFrames)
    setOppParsedData(prev => ({ ...prev, frames: scored, ...computeStats(scored) }))
  }

  const isParsing = phase === 'parsing'
  const isReview = phase === 'review'

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-gray-700">Both scorecards — one photo</p>

      {previewUrl ? (
        <div className="relative mb-3">
          <img src={previewUrl} alt="Scorecard" className="h-36 w-full rounded-xl object-cover" />
          <button
            onClick={() => { setPreviewUrl(null); setImageFile(null); setPhase('input'); setMyParsedData(null); setOppParsedData(null) }}
            className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-4 hover:border-slate-400 transition-colors">
            <svg className="h-6 w-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className="text-xs font-medium text-gray-500">Take Photo</span>
          </button>
          <button onClick={() => galleryRef.current?.click()} className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-4 hover:border-slate-400 transition-colors">
            <svg className="h-6 w-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="text-xs font-medium text-gray-500">Choose Photo</span>
          </button>
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Your label on screen</label>
          <input type="text" value={myPlayerLabel} onChange={e => setMyPlayerLabel(e.target.value.toUpperCase())} placeholder="A" maxLength={3}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono uppercase outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Opponent's label</label>
          <input type="text" value={oppPlayerLabel} onChange={e => setOppPlayerLabel(e.target.value.toUpperCase())} placeholder="B" maxLength={3}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono uppercase outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}

      {isReview && myParsedData && oppParsedData && (
        <div className="mb-3 space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
              <span className="text-xs font-semibold text-gray-700">You — {myParsedData.frames[9]?.runningScore ?? 0}</span>
              <span className="text-[10px] text-gray-400">Tap any ball to edit</span>
            </div>
            <EditableFrameGrid frames={myParsedData.frames} onChange={handleMyFramesChange} />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
              <span className="text-xs font-semibold text-gray-700">Opponent — {oppParsedData.frames[9]?.runningScore ?? 0}</span>
            </div>
            <EditableFrameGrid frames={oppParsedData.frames} onChange={handleOppFramesChange} />
          </div>
        </div>
      )}

      {!isReview ? (
        <button onClick={handleParse} disabled={isParsing || !imageFile}
          className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors">
          {isParsing ? 'Parsing both scores…' : 'Parse Both Scores'}
        </button>
      ) : (
        <button onClick={() => { setPhase('input'); setMyParsedData(null); setOppParsedData(null); setPreviewUrl(null); setImageFile(null) }}
          className="w-full rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          Retake Photo
        </button>
      )}
    </div>
  )
}

export default function VSSubmitModal({ session, onClose, onSaved }) {
  const [step, setStep] = useState(() => loadUploadPrefs()?.selectedFriend ? 2 : 1)
  const [photoMode, setPhotoMode] = useState(() => loadUploadPrefs()?.photoMode ?? 'separate') // 'separate' | 'combined'
  const [friends, setFriends] = useState([])
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [selectedFriend, setSelectedFriend] = useState(() => loadUploadPrefs()?.selectedFriend ?? null)
  const [playedAt, setPlayedAt] = useState(defaultPlayedAt)

  const [myImageFile, setMyImageFile] = useState(null)
  const [myParsedData, setMyParsedData] = useState(null)
  const [myAiFrames, setMyAiFrames] = useState(null)
  const [myPlayerLabel, setMyPlayerLabel] = useState(() => loadUploadPrefs()?.myPlayerLabel ?? '')
  const [myPhase, setMyPhase] = useState('input')
  const [myError, setMyError] = useState(null)

  const [oppImageFile, setOppImageFile] = useState(null)
  const [oppParsedData, setOppParsedData] = useState(null)
  const [oppAiFrames, setOppAiFrames] = useState(null)
  const [oppPlayerLabel, setOppPlayerLabel] = useState(() => loadUploadPrefs()?.oppPlayerLabel ?? '')
  const [oppPhase, setOppPhase] = useState('input')
  const [oppError, setOppError] = useState(null)

  // Combined photo mode uses a shared phase/error
  const [combinedPhase, setCombinedPhase] = useState('input')
  const [combinedError, setCombinedError] = useState(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    async function loadFriends() {
      const { data } = await supabase
        .from('friend_requests')
        .select(`
          id, sender_id, receiver_id,
          sender:sender_id(id, display_name, email),
          receiver:receiver_id(id, display_name, email)
        `)
        .eq('status', 'accepted')
        .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
      const list = (data || []).map(r =>
        r.sender_id === session.user.id ? r.receiver : r.sender
      ).filter(Boolean)
      setFriends(list)
      setLoadingFriends(false)
    }
    loadFriends()
  }, [])

  // separate: 5 steps; combined: 4 steps (step 3 handles both scorecards)
  const STEPS = photoMode === 'combined' ? 4 : 5

  // Maps step number to logical content based on mode
  function stepContent(s) {
    if (s === 1) return 'opponent'
    if (s === 2) return 'datetime'
    if (photoMode === 'combined') {
      if (s === 3) return 'both'
      if (s === 4) return 'summary'
    } else {
      if (s === 3) return 'mycard'
      if (s === 4) return 'oppcard'
      if (s === 5) return 'summary'
    }
  }
  const currentContent = stepContent(step)

  const myScore = myParsedData?.frames[9]?.runningScore ?? 0
  const oppScore = oppParsedData?.frames[9]?.runningScore ?? 0
  const winner = myScore > oppScore ? 'me' : oppScore > myScore ? 'them' : 'tie'

  function resetScorecardState() {
    setMyImageFile(null); setMyParsedData(null); setMyAiFrames(null); setMyPhase('input'); setMyError(null)
    setOppImageFile(null); setOppParsedData(null); setOppAiFrames(null); setOppPhase('input'); setOppError(null)
    setCombinedPhase('input'); setCombinedError(null)
  }

  function handleModeChange(mode) {
    setPhotoMode(mode)
    resetScorecardState()
    if (step > 2) setStep(3)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    const myFramesEdited = myAiFrames && JSON.stringify(myParsedData.frames) !== JSON.stringify(myAiFrames)
    const oppFramesEdited = oppAiFrames && JSON.stringify(oppParsedData.frames) !== JSON.stringify(oppAiFrames)

    const { data, error } = await supabase.rpc('create_vs_match', {
      p_submitter_game: {
        total_score: myScore,
        player_label: myPlayerLabel.trim(),
        frames: myParsedData.frames,
        ...(myFramesEdited ? { ai_frames: myAiFrames } : {}),
      },
      p_opponent_game: {
        total_score: oppScore,
        player_label: oppPlayerLabel.trim(),
        frames: oppParsedData.frames,
        ...(oppFramesEdited ? { ai_frames: oppAiFrames } : {}),
      },
      p_opponent_id: selectedFriend.id,
      p_played_at: new Date(playedAt).toISOString(),
    })

    if (error) {
      setSaveError('Failed to save match: ' + error.message)
      setSaving(false)
      return
    }

    saveUploadPrefs({
      selectedFriend,
      myPlayerLabel: myPlayerLabel.trim(),
      oppPlayerLabel: oppPlayerLabel.trim(),
      photoMode,
    })
    onSaved({
      submitterGame: {
        id: data.submitter_game_id,
        user_id: session.user.id,
        played_at: new Date(playedAt).toISOString(),
        total_score: myScore,
        player_label: myPlayerLabel.trim(),
        strikes: myParsedData.strikes,
        spares: myParsedData.spares,
        opens: myParsedData.opens,
        initial_run: myParsedData.initialRun,
        frames: myParsedData.frames,
        is_vs: true,
        vs_match_id: data.vs_match_id,
        ...(myFramesEdited ? { ai_frames: myAiFrames } : {}),
      },
      vsMatch: {
        id: data.vs_match_id,
        submitter_game_id: data.submitter_game_id,
        opponent_game_id: data.opponent_game_id,
      },
    })
    onClose()
  }

  const canGoNext = (
    (currentContent === 'opponent' && selectedFriend) ||
    currentContent === 'datetime' ||
    (currentContent === 'mycard' && myPhase === 'review' && myParsedData) ||
    (currentContent === 'oppcard' && oppPhase === 'review' && oppParsedData) ||
    (currentContent === 'both' && combinedPhase === 'review' && myParsedData && oppParsedData)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">VS Match</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Step dots */}
        <div className="mb-3 flex items-center justify-center gap-2">
          {Array.from({ length: STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i + 1 < step ? 'w-2 bg-slate-700' :
                i + 1 === step ? 'w-4 bg-slate-800' :
                'w-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Quick-start banner — shown when opponent is pre-selected and we've moved past step 1 */}
        {selectedFriend && step > 1 && (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <span className="text-gray-500">
              vs <span className="font-semibold text-gray-900">{selectedFriend.display_name || selectedFriend.email}</span>
            </span>
            <button
              onClick={() => setStep(1)}
              className="font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Edit
            </button>
          </div>
        )}

        {/* Photo mode toggle — visible on steps 1-3 */}
        {step <= 3 && (
          <div className="mb-4 flex rounded-lg border border-gray-200 p-0.5">
            <button
              onClick={() => handleModeChange('separate')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors
                ${photoMode === 'separate' ? 'bg-slate-800 text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Two photos
            </button>
            <button
              onClick={() => handleModeChange('combined')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors
                ${photoMode === 'combined' ? 'bg-slate-800 text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              One photo
            </button>
          </div>
        )}

        {/* Step 1: Pick opponent */}
        {currentContent === 'opponent' && (
          <div>
            <p className="mb-3 text-sm font-semibold text-gray-700">Who did you bowl against?</p>
            {loadingFriends ? (
              <p className="py-6 text-center text-sm text-gray-400">Loading friends…</p>
            ) : friends.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No friends yet. Add friends first.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {friends.map(f => {
                  const name = f.display_name || f.email || 'Unknown'
                  const initials = name.slice(0, 2).toUpperCase()
                  const isSelected = selectedFriend?.id === f.id
                  return (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFriend(f)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors
                        ${isSelected
                          ? 'border-slate-700 bg-slate-50'
                          : 'border-gray-100 bg-white hover:border-gray-300'}`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                        {f.display_name && <p className="text-xs text-gray-400 truncate">{f.email}</p>}
                      </div>
                      {isSelected && (
                        <svg className="ml-auto h-4 w-4 shrink-0 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Date & time */}
        {currentContent === 'datetime' && (
          <div>
            <p className="mb-3 text-sm font-semibold text-gray-700">When did you bowl?</p>
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
        )}

        {/* Step 3 (separate): Your scorecard */}
        {currentContent === 'mycard' && (
          <ScorecardStep
            title="Your scorecard"
            playerLabel={myPlayerLabel}
            setPlayerLabel={setMyPlayerLabel}
            imageFile={myImageFile}
            setImageFile={setMyImageFile}
            parsedData={myParsedData}
            setParsedData={setMyParsedData}
            aiFrames={myAiFrames}
            setAiFrames={setMyAiFrames}
            phase={myPhase}
            setPhase={setMyPhase}
            error={myError}
            setError={setMyError}
            labelPlaceholder="A"
          />
        )}

        {/* Step 3 (combined): Both scorecards in one photo */}
        {currentContent === 'both' && (
          <CombinedScorecardStep
            myPlayerLabel={myPlayerLabel} setMyPlayerLabel={setMyPlayerLabel}
            myParsedData={myParsedData} setMyParsedData={setMyParsedData} setMyAiFrames={setMyAiFrames}
            oppPlayerLabel={oppPlayerLabel} setOppPlayerLabel={setOppPlayerLabel}
            oppParsedData={oppParsedData} setOppParsedData={setOppParsedData} setOppAiFrames={setOppAiFrames}
            phase={combinedPhase} setPhase={setCombinedPhase}
            error={combinedError} setError={setCombinedError}
          />
        )}

        {/* Step 4 (separate): Opponent's scorecard */}
        {currentContent === 'oppcard' && (
          <ScorecardStep
            title={`${selectedFriend?.display_name || selectedFriend?.email || 'Opponent'}'s scorecard`}
            playerLabel={oppPlayerLabel}
            setPlayerLabel={setOppPlayerLabel}
            imageFile={oppImageFile}
            setImageFile={setOppImageFile}
            parsedData={oppParsedData}
            setParsedData={setOppParsedData}
            aiFrames={oppAiFrames}
            setAiFrames={setOppAiFrames}
            phase={oppPhase}
            setPhase={setOppPhase}
            error={oppError}
            setError={setOppError}
            labelPlaceholder="B"
          />
        )}

        {/* Summary & confirm */}
        {currentContent === 'summary' && (
          <div>
            <p className="mb-4 text-sm font-semibold text-gray-700">Match summary</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* My side */}
              <div className={`rounded-xl border-2 p-3 text-center ${winner === 'me' ? 'border-green-400 bg-green-50' : winner === 'tie' ? 'border-gray-300 bg-gray-50' : 'border-gray-100 bg-white'}`}>
                <p className="text-xs font-medium text-gray-500 mb-1">You</p>
                <p className={`text-3xl font-bold ${winner === 'me' ? 'text-green-700' : winner === 'tie' ? 'text-gray-700' : 'text-gray-900'}`}>{myScore}</p>
                {winner === 'me' && <p className="mt-1 text-xs font-bold text-green-600">WIN</p>}
                {winner === 'tie' && <p className="mt-1 text-xs font-bold text-gray-500">TIE</p>}
                {winner === 'them' && <p className="mt-1 text-xs font-bold text-red-500">LOSS</p>}
                {myParsedData && (
                  <div className="mt-2 overflow-x-auto">
                    <FrameGrid frames={myParsedData.frames} />
                  </div>
                )}
              </div>
              {/* Opponent side */}
              <div className={`rounded-xl border-2 p-3 text-center ${winner === 'them' ? 'border-green-400 bg-green-50' : winner === 'tie' ? 'border-gray-300 bg-gray-50' : 'border-gray-100 bg-white'}`}>
                <p className="text-xs font-medium text-gray-500 mb-1 truncate">{selectedFriend?.display_name || selectedFriend?.email || 'Opponent'}</p>
                <p className={`text-3xl font-bold ${winner === 'them' ? 'text-green-700' : winner === 'tie' ? 'text-gray-700' : 'text-gray-900'}`}>{oppScore}</p>
                {winner === 'them' && <p className="mt-1 text-xs font-bold text-green-600">WIN</p>}
                {winner === 'tie' && <p className="mt-1 text-xs font-bold text-gray-500">TIE</p>}
                {winner === 'me' && <p className="mt-1 text-xs font-bold text-red-500">LOSS</p>}
                {oppParsedData && (
                  <div className="mt-2 overflow-x-auto">
                    <FrameGrid frames={oppParsedData.frames} />
                  </div>
                )}
              </div>
            </div>
            {saveError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{saveError}</p>}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-4 flex gap-2">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={saving}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Back
            </button>
          )}
          {step < STEPS ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canGoNext}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Match'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
