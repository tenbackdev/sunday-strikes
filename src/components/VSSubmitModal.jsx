import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { parseScorecard, parseBothScorecards } from '../lib/gemini'
import { computeStats, computeScores } from '../lib/parseGame'
import { sanitizeFrames } from '../lib/validateFrames'
import { StatTable, FrameGrid, EditableFrameGrid, ParseWarningBanner } from './Scorecard'
import { avatarStyle } from '../lib/avatar'
import { loadUploadPrefs, saveUploadPrefs, loadOpponentPref, saveOpponentPref } from '../lib/uploadPrefs'

function defaultPlayedAt() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function ThemedInput({ className = '', style = {}, ...props }) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg px-3 py-2 text-base outline-none transition-colors ${className}`}
      style={{
        background: 'var(--elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        ...style,
      }}
      onFocus={e => {
        e.target.style.borderColor = 'var(--accent)'
        e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)'
      }}
      onBlur={e => {
        e.target.style.borderColor = 'var(--border)'
        e.target.style.boxShadow = 'none'
      }}
    />
  )
}

function PhotoZoneButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl py-4 transition-colors"
      style={{ border: '2px dashed var(--border)' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 50%, transparent)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {children}
    </button>
  )
}

function ErrorBanner({ msg }) {
  if (!msg) return null
  return (
    <p className="mb-3 rounded-lg px-3 py-2 text-xs font-medium"
      style={{ background: 'color-mix(in srgb, var(--loss) 12%, transparent)', color: 'var(--loss)' }}>
      {msg}
    </p>
  )
}

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ steps, currentStep }) {
  return (
    <div className="flex items-start mb-4">
      {steps.map((label, i) => {
        const num = i + 1
        const done = num < currentStep
        const curr = num === currentStep
        return (
          <div key={label} className="flex flex-col items-center gap-1 flex-1 relative">
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className="absolute top-[11px] z-0"
                style={{
                  left: '58%', right: '-38%', height: '2px',
                  background: done ? 'var(--accent)' : 'var(--border)',
                  transition: 'background 0.3s',
                }}
              />
            )}
            {/* Circle */}
            <div
              className="relative z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-bold transition-all"
              style={done ? {
                background: 'var(--accent)', color: 'var(--acc-text)',
              } : curr ? {
                background: 'transparent',
                border: '2px solid var(--accent)',
                color: 'var(--accent)',
                boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)',
              } : {
                background: 'var(--border)',
                color: 'var(--sub)',
              }}
            >
              {done ? '✓' : num}
            </div>
            <span
              className="text-[9px] font-medium whitespace-nowrap"
              style={{ color: curr ? 'var(--accent)' : 'var(--sub)' }}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Scorecard step (single player photo) ─────────────────────────────────────

function ScorecardStep({ title, playerLabel, setPlayerLabel, imageFile, setImageFile, parsedData, setParsedData, setAiFrames, phase, setPhase, error, setError, labelPlaceholder }) {
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [parseWarnings, setParseWarnings] = useState([])

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setError(null); setParsedData(null); setAiFrames(null); setParseWarnings([]); setPhase('input')
  }

  async function handleParse() {
    if (!imageFile) { setError('Select a photo first.'); return }
    if (!playerLabel.trim()) { setError('Enter the label shown on screen for this player.'); return }
    setPhase('parsing'); setError(null)
    try {
      const result = await parseScorecard(imageFile, playerLabel.trim())
      if (!result.found) {
        setError(result.error || `Could not find player "${playerLabel}" in the photo.`)
        setPhase('input'); return
      }
      const { frames: sanitized, warnings } = sanitizeFrames(result.frames)
      const scored = computeScores(sanitized)
      const stats = computeStats(scored)
      setParseWarnings(warnings)
      setAiFrames(JSON.parse(JSON.stringify(scored)))
      setParsedData({ frames: scored, ...stats })
      setPhase('review')
    } catch (err) {
      setError(err.message || 'Failed to parse photo.'); setPhase('input')
    }
  }

  function handleFramesChange(newFrames) {
    const scored = computeScores(newFrames)
    setParsedData({ frames: scored, ...computeStats(scored) })
  }

  const isParsing = phase === 'parsing'
  const isReview = phase === 'review'
  const totalScore = parsedData?.frames[9]?.runningScore ?? 0

  return (
    <div>
      <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</p>

      {previewUrl ? (
        <div className="relative mb-3">
          <img src={previewUrl} alt="Scorecard" className="h-36 w-full rounded-xl object-cover" />
          <button
            onClick={() => { setPreviewUrl(null); setImageFile(null); setPhase('input'); setParsedData(null) }}
            className="absolute right-2 top-2 rounded-full p-1 text-white transition-colors"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <PhotoZoneButton onClick={() => cameraRef.current?.click()}>
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--sub)', opacity: 0.5 }}>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className="text-xs font-medium" style={{ color: 'var(--sub)' }}>Take Photo</span>
          </PhotoZoneButton>
          <PhotoZoneButton onClick={() => galleryRef.current?.click()}>
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--sub)', opacity: 0.5 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="text-xs font-medium" style={{ color: 'var(--sub)' }}>Choose Photo</span>
          </PhotoZoneButton>
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--sub)' }}>Player label on screen</label>
        <LabelChip value={playerLabel} onChange={setPlayerLabel} placeholder={labelPlaceholder ?? 'A'} />
      </div>

      <ErrorBanner msg={error} />

      {isReview && parsedData && (
        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--elevated)' }}>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl" style={{ color: 'var(--text)' }}>{totalScore}</span>
              <span className="text-sm" style={{ color: 'var(--sub)' }}>total</span>
            </div>
            <StatTable strikes={parsedData.strikes} spares={parsedData.spares} opens={parsedData.opens} initialRun={parsedData.initialRun} frames={parsedData.frames} />
          </div>
          <ParseWarningBanner warnings={parseWarnings} />
          <p className="mb-2 text-[10px]" style={{ color: 'var(--sub)' }}>Tap any ball to edit</p>
          <EditableFrameGrid frames={parsedData.frames} onChange={handleFramesChange} />
        </div>
      )}

      {!isReview ? (
        <button
          onClick={handleParse}
          disabled={isParsing || !imageFile}
          className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--acc-text)' }}
        >
          {isParsing ? 'Parsing photo…' : 'Parse Score'}
        </button>
      ) : (
        <button
          onClick={() => { setPhase('input'); setParsedData(null); setPreviewUrl(null); setImageFile(null) }}
          className="w-full rounded-xl py-2 text-sm font-medium transition-colors"
          style={{ border: '1px solid var(--border)', color: 'var(--sub)' }}
        >
          Retake Photo
        </button>
      )}
    </div>
  )
}

// ── Combined scorecard step (both players, one photo) ────────────────────────

function CombinedScorecardStep({ myPlayerLabel, setMyPlayerLabel, myParsedData, setMyParsedData, setMyAiFrames, oppPlayerLabel, setOppPlayerLabel, oppParsedData, setOppParsedData, setOppAiFrames, phase, setPhase, error, setError }) {
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [myParseWarnings, setMyParseWarnings] = useState([])
  const [oppParseWarnings, setOppParseWarnings] = useState([])

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setError(null); setMyParsedData(null); setOppParsedData(null)
    setMyParseWarnings([]); setOppParseWarnings([]); setPhase('input')
  }

  async function handleParse() {
    if (!imageFile) { setError('Select a photo first.'); return }
    setPhase('parsing'); setError(null)
    try {
      const result = await parseBothScorecards(imageFile, myPlayerLabel.trim(), oppPlayerLabel.trim())
      const players = result?.players ?? []
      const myRaw = players.find(p => p.label?.toUpperCase() === myPlayerLabel.trim().toUpperCase())
      const oppRaw = players.find(p => p.label?.toUpperCase() === oppPlayerLabel.trim().toUpperCase())
      if (!myRaw?.found) { setError(`Could not find player "${myPlayerLabel}" in the photo.`); setPhase('input'); return }
      if (!oppRaw?.found) { setError(`Could not find player "${oppPlayerLabel}" in the photo.`); setPhase('input'); return }
      const { frames: mySanitized, warnings: myWarn } = sanitizeFrames(myRaw.frames)
      const { frames: oppSanitized, warnings: oppWarn } = sanitizeFrames(oppRaw.frames)
      const myScored = computeScores(mySanitized)
      const oppScored = computeScores(oppSanitized)
      setMyParseWarnings(myWarn)
      setOppParseWarnings(oppWarn)
      setMyAiFrames(JSON.parse(JSON.stringify(myScored)))
      setMyParsedData({ frames: myScored, ...computeStats(myScored) })
      setOppAiFrames(JSON.parse(JSON.stringify(oppScored)))
      setOppParsedData({ frames: oppScored, ...computeStats(oppScored) })
      setPhase('review')
    } catch (err) {
      setError(err.message || 'Failed to parse photo.'); setPhase('input')
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
      <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--text)' }}>Both scorecards — one photo</p>

      {previewUrl ? (
        <div className="relative mb-3">
          <img src={previewUrl} alt="Scorecard" className="h-36 w-full rounded-xl object-cover" />
          <button
            onClick={() => { setPreviewUrl(null); setImageFile(null); setPhase('input'); setMyParsedData(null); setOppParsedData(null) }}
            className="absolute right-2 top-2 rounded-full p-1 text-white"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <PhotoZoneButton onClick={() => cameraRef.current?.click()}>
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--sub)', opacity: 0.5 }}>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span className="text-xs font-medium" style={{ color: 'var(--sub)' }}>Take Photo</span>
          </PhotoZoneButton>
          <PhotoZoneButton onClick={() => galleryRef.current?.click()}>
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--sub)', opacity: 0.5 }}>
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span className="text-xs font-medium" style={{ color: 'var(--sub)' }}>Choose Photo</span>
          </PhotoZoneButton>
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--sub)' }}>Your label on screen</label>
          <LabelChip value={myPlayerLabel} onChange={setMyPlayerLabel} placeholder="A" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--sub)' }}>Opponent's label</label>
          <LabelChip value={oppPlayerLabel} onChange={setOppPlayerLabel} placeholder="P" />
        </div>
      </div>

      <ErrorBanner msg={error} />

      {isReview && myParsedData && oppParsedData && (
        <div className="mb-3 space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between rounded-lg px-3 py-1.5" style={{ background: 'var(--elevated)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>You — {myParsedData.frames[9]?.runningScore ?? 0}</span>
              <span className="text-[10px]" style={{ color: 'var(--sub)' }}>Tap any ball to edit</span>
            </div>
            <ParseWarningBanner warnings={myParseWarnings} />
            <EditableFrameGrid frames={myParsedData.frames} onChange={handleMyFramesChange} />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between rounded-lg px-3 py-1.5" style={{ background: 'var(--elevated)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Opponent — {oppParsedData.frames[9]?.runningScore ?? 0}</span>
            </div>
            <ParseWarningBanner warnings={oppParseWarnings} />
            <EditableFrameGrid frames={oppParsedData.frames} onChange={handleOppFramesChange} />
          </div>
        </div>
      )}

      {!isReview ? (
        <button
          onClick={handleParse}
          disabled={isParsing || !imageFile}
          className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--acc-text)' }}
        >
          {isParsing ? 'Parsing both scores…' : 'Parse Both Scores'}
        </button>
      ) : (
        <button
          onClick={() => { setPhase('input'); setMyParsedData(null); setOppParsedData(null); setPreviewUrl(null); setImageFile(null) }}
          className="w-full rounded-xl py-2 text-sm font-medium transition-colors"
          style={{ border: '1px solid var(--border)', color: 'var(--sub)' }}
        >
          Retake Photo
        </button>
      )}
    </div>
  )
}

// ── Label chip (tap-to-edit player label) ────────────────────────────────────

function LabelChip({ value, onChange, placeholder }) {
  const [editing, setEditing] = useState(!value)

  if (editing || !value) {
    return (
      <ThemedInput
        type="text"
        value={value}
        onChange={e => onChange(e.target.value.toUpperCase())}
        placeholder={placeholder ?? 'A'}
        maxLength={3}
        className="font-mono uppercase"
        autoFocus
        onBlur={() => { if (value) setEditing(false) }}
      />
    )
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-bold tracking-widest transition-all active:scale-95"
      style={{
        background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
        color: 'var(--accent)',
        border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
        fontFamily: 'var(--font-display)',
        fontSize: '1rem',
      }}
    >
      {value}
      <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>
  )
}

// ── Setup step (opponent + datetime, merged) ──────────────────────────────────

function SetupStep({ friends, loadingFriends, selectedFriend, setSelectedFriend, playedAt, setPlayedAt, onNext, myPlayerLabel, oppPlayerLabel }) {
  const [showDateEdit, setShowDateEdit] = useState(false)

  const formattedTime = (() => {
    try {
      return new Date(playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch { return playedAt }
  })()

  const allPreFilled = selectedFriend && myPlayerLabel && oppPlayerLabel

  return (
    <div>
      <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--text)' }}>Who did you bowl against?</p>

      {allPreFilled && (
        <div
          className="mb-3 flex items-center justify-between rounded-lg px-3 py-2 text-xs"
          style={{ background: 'color-mix(in srgb, var(--win) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--win) 20%, transparent)' }}
        >
          <span style={{ color: 'var(--sub)' }}>Ready — tap <strong style={{ color: 'var(--text)' }}>Next</strong> to add photos</span>
          <button onClick={onNext} className="font-semibold" style={{ color: 'var(--win)' }}>Next →</button>
        </div>
      )}

      {loadingFriends ? (
        <p className="py-6 text-center text-sm" style={{ color: 'var(--sub)' }}>Loading friends…</p>
      ) : friends.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: 'var(--sub)' }}>No friends yet. Add friends first.</p>
      ) : (
        <div className="mb-4 space-y-2 max-h-56 overflow-y-auto">
          {friends.map(f => {
            const name = f.display_name || f.email || 'Unknown'
            const initials = name.slice(0, 2).toUpperCase()
            const isSelected = selectedFriend?.id === f.id
            return (
              <button
                key={f.id}
                onClick={() => setSelectedFriend(f)}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors"
                style={{
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  background: isSelected ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'var(--elevated)',
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={avatarStyle(f.avatar_color)}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{name}</p>
                  {f.display_name && <p className="text-xs truncate" style={{ color: 'var(--sub)' }}>{f.email}</p>}
                </div>
                {isSelected && (
                  <svg className="ml-auto h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent)' }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Datetime disclosure */}
      <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>
        {showDateEdit ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium" style={{ color: 'var(--sub)' }}>Date &amp; time played</label>
              <button onClick={() => setShowDateEdit(false)} className="text-xs" style={{ color: 'var(--accent)' }}>Done</button>
            </div>
            <ThemedInput type="datetime-local" value={playedAt} onChange={e => setPlayedAt(e.target.value)} />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--sub)' }}>
              Bowled at <span className="font-semibold" style={{ color: 'var(--text)' }}>{formattedTime}</span>
            </span>
            <button onClick={() => setShowDateEdit(true)} className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
              Change →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function VSSubmitModal({ session, onClose, onSaved }) {
  const [step, setStep] = useState(() => loadOpponentPref() ? 2 : 1)
  const [photoMode, setPhotoMode] = useState(() => loadUploadPrefs()?.photoMode ?? 'separate')
  const [friends, setFriends] = useState([])
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [selectedFriend, setSelectedFriend] = useState(() => loadOpponentPref() ?? null)
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

  const [combinedPhase, setCombinedPhase] = useState('input')
  const [combinedError, setCombinedError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    async function loadFriends() {
      const { data } = await supabase
        .from('friend_requests')
        .select(`id, sender_id, receiver_id, sender:sender_id(id, display_name, email, avatar_color), receiver:receiver_id(id, display_name, email, avatar_color)`)
        .eq('status', 'accepted')
        .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
      const list = (data || []).map(r => r.sender_id === session.user.id ? r.receiver : r.sender)
      setFriends(list)
      setLoadingFriends(false)
    }
    loadFriends()
  }, [])

  const STEPS = photoMode === 'combined' ? 3 : 4
  const STEP_LABELS = photoMode === 'combined'
    ? ['Setup', 'Scorecards', 'Summary']
    : ['Setup', 'Your Score', 'Their Score', 'Summary']

  function stepContent(s) {
    if (s === 1) return 'setup'
    if (photoMode === 'combined') {
      if (s === 2) return 'both'
      if (s === 3) return 'summary'
    } else {
      if (s === 2) return 'mycard'
      if (s === 3) return 'oppcard'
      if (s === 4) return 'summary'
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
    if (step > 1) setStep(2)
  }

  async function handleSave() {
    if (myScore < 0 || myScore > 300) {
      setSaveError('Your computed score is out of range (0–300). Check your frame entries.')
      return
    }
    if (oppScore < 0 || oppScore > 300) {
      setSaveError('Opponent computed score is out of range (0–300). Check their frame entries.')
      return
    }
    setSaving(true); setSaveError(null)
    const myFramesEdited = myAiFrames && JSON.stringify(myParsedData.frames) !== JSON.stringify(myAiFrames)
    const oppFramesEdited = oppAiFrames && JSON.stringify(oppParsedData.frames) !== JSON.stringify(oppAiFrames)
    const { data, error } = await supabase.rpc('create_vs_match', {
      p_submitter_game: {
        total_score: myScore, player_label: myPlayerLabel.trim(), frames: myParsedData.frames,
        ...(myFramesEdited ? { ai_frames: myAiFrames } : {}),
      },
      p_opponent_game: {
        total_score: oppScore, player_label: oppPlayerLabel.trim(), frames: oppParsedData.frames,
        ...(oppFramesEdited ? { ai_frames: oppAiFrames } : {}),
      },
      p_opponent_id: selectedFriend.id,
      p_played_at: new Date(playedAt).toISOString(),
    })
    if (error) { setSaveError('Failed to save match: ' + error.message); setSaving(false); return }
    saveOpponentPref(selectedFriend)
    saveUploadPrefs({ myPlayerLabel: myPlayerLabel.trim(), oppPlayerLabel: oppPlayerLabel.trim(), photoMode })
    onSaved({
      submitterGame: {
        id: data.submitter_game_id, user_id: session.user.id, played_at: new Date(playedAt).toISOString(),
        total_score: myScore, player_label: myPlayerLabel.trim(), ...computeStats(myParsedData.frames),
        frames: myParsedData.frames, is_vs: true, vs_match_id: data.vs_match_id,
        ...(myFramesEdited ? { ai_frames: myAiFrames } : {}),
      },
      vsMatch: { id: data.vs_match_id, submitter_game_id: data.submitter_game_id, opponent_game_id: data.opponent_game_id },
    })
    onClose()
  }

  const canGoNext = (
    (currentContent === 'setup' && !!selectedFriend) ||
    (currentContent === 'mycard' && myPhase === 'review' && myParsedData) ||
    (currentContent === 'oppcard' && oppPhase === 'review' && oppParsedData) ||
    (currentContent === 'both' && combinedPhase === 'review' && myParsedData && oppParsedData)
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center modal-overlay"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl max-h-[92vh] overflow-y-auto modal-enter modal-grain"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl" style={{ color: 'var(--text)' }}>VS Match</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 transition-colors" style={{ color: 'var(--sub)' }}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Stepper */}
        <Stepper steps={STEP_LABELS} currentStep={step} />

        {/* Quick-start banner */}
        {selectedFriend && step > 1 && (
          <div
            className="mb-3 flex items-center justify-between rounded-lg px-3 py-2 text-xs"
            style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}
          >
            <span style={{ color: 'var(--sub)' }}>
              vs <span className="font-semibold" style={{ color: 'var(--text)' }}>{selectedFriend.display_name || selectedFriend.email}</span>
            </span>
            <button onClick={() => setStep(1)} className="font-medium transition-colors" style={{ color: 'var(--accent)' }}>
              Edit
            </button>
          </div>
        )}

        {/* Photo mode toggle (steps 1-2) */}
        {step <= 2 && (
          <div className="mb-4 flex rounded-lg p-0.5" style={{ border: '1px solid var(--border)', background: 'var(--elevated)' }}>
            <button
              onClick={() => handleModeChange('separate')}
              className="flex-1 rounded-md py-1.5 text-xs font-medium transition-colors"
              style={photoMode === 'separate' ? { background: 'var(--accent)', color: 'var(--acc-text)' } : { color: 'var(--sub)' }}
            >
              Two photos
            </button>
            <button
              onClick={() => handleModeChange('combined')}
              className="flex-1 rounded-md py-1.5 text-xs font-medium transition-colors"
              style={photoMode === 'combined' ? { background: 'var(--accent)', color: 'var(--acc-text)' } : { color: 'var(--sub)' }}
            >
              One photo
            </button>
          </div>
        )}

        {/* Step 1: Setup (opponent + datetime combined) */}
        {currentContent === 'setup' && (
          <SetupStep
            friends={friends}
            loadingFriends={loadingFriends}
            selectedFriend={selectedFriend}
            setSelectedFriend={setSelectedFriend}
            playedAt={playedAt}
            setPlayedAt={setPlayedAt}
            onNext={() => setStep(2)}
            myPlayerLabel={myPlayerLabel}
            oppPlayerLabel={oppPlayerLabel}
          />
        )}

        {/* Step 3 (separate): Your scorecard */}
        {currentContent === 'mycard' && (
          <ScorecardStep
            title="Your scorecard"
            playerLabel={myPlayerLabel} setPlayerLabel={setMyPlayerLabel}
            imageFile={myImageFile} setImageFile={setMyImageFile}
            parsedData={myParsedData} setParsedData={setMyParsedData}
            aiFrames={myAiFrames} setAiFrames={setMyAiFrames}
            phase={myPhase} setPhase={setMyPhase}
            error={myError} setError={setMyError}
            labelPlaceholder="A"
          />
        )}

        {/* Step 3 (combined): Both scorecards */}
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
            playerLabel={oppPlayerLabel} setPlayerLabel={setOppPlayerLabel}
            imageFile={oppImageFile} setImageFile={setOppImageFile}
            parsedData={oppParsedData} setParsedData={setOppParsedData}
            aiFrames={oppAiFrames} setAiFrames={setOppAiFrames}
            phase={oppPhase} setPhase={setOppPhase}
            error={oppError} setError={setOppError}
            labelPlaceholder="P"
          />
        )}

        {/* Summary */}
        {currentContent === 'summary' && (
          <div>
            <p className="mb-4 text-sm font-semibold" style={{ color: 'var(--text)' }}>Match summary</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* My side */}
              <div
                className="rounded-xl p-3 text-center"
                style={{
                  border: `2px solid ${winner === 'me' ? 'var(--accent)' : winner === 'tie' ? 'var(--border)' : 'color-mix(in srgb, var(--loss) 30%, transparent)'}`,
                  background: winner === 'me' ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'var(--elevated)',
                  boxShadow: winner === 'me' ? 'var(--shadow-accent)' : 'none',
                }}
              >
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--sub)' }}>You</p>
                <p className="font-display text-4xl leading-none mb-1"
                  style={{ color: winner === 'me' ? 'var(--accent)' : winner === 'tie' ? 'var(--text)' : 'var(--sub)' }}>
                  {myScore}
                </p>
                <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold mt-1 font-display tracking-wider"
                  style={winner === 'me' ? { background: 'var(--accent)', color: 'var(--acc-text)' } :
                    winner === 'tie' ? { background: 'color-mix(in srgb, var(--sub) 15%, transparent)', color: 'var(--sub)' } :
                    { background: 'color-mix(in srgb, var(--loss) 15%, transparent)', color: 'var(--loss)' }}>
                  {winner === 'me' ? 'WIN' : winner === 'tie' ? 'TIE' : 'LOSS'}
                </span>
                {myParsedData && (
                  <div className="mt-2 overflow-x-auto">
                    <FrameGrid frames={myParsedData.frames} />
                  </div>
                )}
              </div>

              {/* Opponent side */}
              <div
                className="rounded-xl p-3 text-center"
                style={{
                  border: `2px solid ${winner === 'them' ? 'var(--accent)' : winner === 'tie' ? 'var(--border)' : 'color-mix(in srgb, var(--loss) 30%, transparent)'}`,
                  background: winner === 'them' ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'var(--elevated)',
                  boxShadow: winner === 'them' ? 'var(--shadow-accent)' : 'none',
                }}
              >
                <p className="text-xs font-medium mb-1 truncate" style={{ color: 'var(--sub)' }}>
                  {selectedFriend?.display_name || selectedFriend?.email || 'Opponent'}
                </p>
                <p className="font-display text-4xl leading-none mb-1"
                  style={{ color: winner === 'them' ? 'var(--accent)' : winner === 'tie' ? 'var(--text)' : 'var(--sub)' }}>
                  {oppScore}
                </p>
                <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold mt-1 font-display tracking-wider"
                  style={winner === 'them' ? { background: 'var(--accent)', color: 'var(--acc-text)' } :
                    winner === 'tie' ? { background: 'color-mix(in srgb, var(--sub) 15%, transparent)', color: 'var(--sub)' } :
                    { background: 'color-mix(in srgb, var(--loss) 15%, transparent)', color: 'var(--loss)' }}>
                  {winner === 'them' ? 'WIN' : winner === 'tie' ? 'TIE' : 'LOSS'}
                </span>
                {oppParsedData && (
                  <div className="mt-2 overflow-x-auto">
                    <FrameGrid frames={oppParsedData.frames} />
                  </div>
                )}
              </div>
            </div>
            <ErrorBanner msg={saveError} />
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-4 flex gap-2">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={saving}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              style={{ border: '1px solid var(--border)', color: 'var(--sub)' }}
            >
              Back
            </button>
          )}
          {step < STEPS ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canGoNext}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--acc-text)' }}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--acc-text)' }}
            >
              {saving ? 'Saving…' : 'Save Match'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
