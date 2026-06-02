import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { parseScorecard } from '../lib/gemini'
import { computeStats, computeScores, normalizeFrames } from '../lib/parseGame'
import { StatTable, EditableFrameGrid, MiniGrid, StatStrip } from './Scorecard'
import { loadUploadPrefs, saveUploadPrefs } from '../lib/uploadPrefs'

// ── Shared modal shell ───────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center modal-overlay"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl max-h-[90vh] overflow-y-auto modal-enter"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-float)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl" style={{ color: 'var(--text)' }}>{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--sub)' }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Themed input ─────────────────────────────────────────────────────────────

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

// ── Datetime disclosure ───────────────────────────────────────────────────────

function DateTimeDisclosure({ playedAt, setPlayedAt }) {
  const [showEdit, setShowEdit] = useState(false)

  const formattedTime = (() => {
    try { return new Date(playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    catch { return playedAt }
  })()

  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>
      {showEdit ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium" style={{ color: 'var(--sub)' }}>Date &amp; time played</label>
            <button onClick={() => setShowEdit(false)} className="text-xs" style={{ color: 'var(--accent)' }}>Done</button>
          </div>
          <ThemedInput type="datetime-local" value={playedAt} onChange={e => setPlayedAt(e.target.value)} />
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--sub)' }}>
            Bowled at <span className="font-semibold" style={{ color: 'var(--text)' }}>{formattedTime}</span>
          </span>
          <button onClick={() => setShowEdit(true)} className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
            Change →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Warm palette constants ────────────────────────────────────────────────────

const AMBER   = '#BE7C2A'
const W_CARD  = '#FBF5E8'
const W_INSET = '#F6EED9'
const W_LINE  = '#DECCA2'
const W_FAINT = '#E7D9B8'
const W_HARD  = '#CDB988'

// Height of Layout's fixed top bar (h-14 = 56px) — used for sticky offset math
const FIXED_H = 56
// Rendered height of MonthDivider — used to offset DayHeader below it
const MONTH_DIVIDER_H = 30

const TIME_FILTERS = [
  { key: 'all',  label: 'All Time' },
  { key: 'year', label: 'This Year' },
  { key: '3mo',  label: '3 Months' },
  { key: '30d',  label: '30 Days' },
]

// ── Day summary ───────────────────────────────────────────────────────────────

function computeDaySummary(games) {
  if (!games.length) return { count: 0, avg: 0, hi: 0, lo: 0, strikes: 0, spares: 0, opens: 0, splits: 0, conv: 0, run: 0 }
  const scores = games.map(g => g.total_score ?? 0)
  const totalPins = scores.reduce((s, v) => s + v, 0)
  let strikes = 0, spares = 0, opens = 0, splits = 0, conv = 0, run = 0
  for (const g of games) {
    const st = computeStats(g.frames ?? [])
    strikes += st.strikes
    spares  += st.spares
    opens   += st.opens
    splits  += st.splits ?? 0
    conv    += st.conv ?? 0
    run = Math.max(run, st.run ?? st.initialRun ?? 0)
  }
  return {
    count: games.length,
    avg: Math.round(totalPins / games.length),
    hi: Math.max(...scores),
    lo: Math.min(...scores),
    strikes, spares, opens, splits, conv, run,
  }
}

// ── Marks strip ───────────────────────────────────────────────────────────────

function MarksStrip({ frames }) {
  return (
    <div style={{ display: 'flex', border: `1px solid ${W_FAINT}`, borderRadius: 7, overflow: 'hidden', background: W_INSET }}>
      {frames.map((fr, fi) => {
        const isTenth = fr.frame === 10
        return (
          <div key={fr.frame} style={{ flex: isTenth ? 1.5 : 1, borderRight: fi < frames.length - 1 ? `1px solid ${W_FAINT}` : 'none', display: 'flex', flexDirection: 'column' }}>
            <div style={{ textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: 'var(--sub)', padding: '2px 0', borderBottom: `1px solid ${W_FAINT}`, background: 'rgba(222,204,162,0.28)' }}>
              {fr.frame}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 3, padding: '4px 0', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600 }}>
              {(fr.balls ?? []).map((b, bi) => (
                <span key={bi} style={{ color: b === 'X' ? 'var(--strike)' : b === '/' ? 'var(--spare)' : (b === '-' || b === '' || b == null) ? 'rgba(154,126,80,0.5)' : 'var(--text)' }}>
                  {b === '-' ? '–' : (b === '' || b == null) ? '·' : b}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Day header with stat band ─────────────────────────────────────────────────

function DayHeader({ label, games, stickyTop }) {
  const s = computeDaySummary(games)
  const bits = [
    { k: 'X',  v: s.strikes, c: 'var(--strike)' },
    { k: '/',  v: s.spares,  c: 'var(--spare)'  },
    { k: '–',  v: s.opens,   c: 'var(--sub)'    },
    { k: '#',  v: s.run,     c: 'var(--text)'   },
    { k: 'S',  v: s.splits,  c: 'var(--text)'   },
    { k: 'S/', v: s.conv,    c: 'var(--win)'    },
  ]
  return (
    <div style={{ position: 'sticky', top: stickyTop, zIndex: 14, background: 'var(--bg)', paddingBottom: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
        <h3 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em', color: 'var(--text)' }}>{label}</h3>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: 'var(--sub)', background: W_INSET, border: `1px solid ${W_FAINT}`, borderRadius: 999, padding: '1px 8px' }}>
          {s.count} {s.count === 1 ? 'game' : 'games'}
        </span>
        <div style={{ flex: 1, height: 1, background: W_FAINT }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 12, border: `1px solid ${W_LINE}`, background: W_CARD, overflow: 'hidden', boxShadow: '0 1px 2px rgba(60,40,15,0.05)' }}>
        <div style={{ flex: '0 0 auto', padding: '9px 15px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: `1px solid ${W_FAINT}`, background: 'rgba(222,204,162,0.22)' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 30, lineHeight: 0.88, letterSpacing: '-0.03em', color: 'var(--text)' }}>{s.avg}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--sub)', marginTop: 5 }}>DAY AVG</div>
        </div>
        <div style={{ flex: '0 0 auto', padding: '0 13px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7, borderRight: `1px solid ${W_FAINT}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--win)' }}>HI</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--text)', lineHeight: 1 }}>{s.hi}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--sub)' }}>LO</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--text)', lineHeight: 1 }}>{s.lo}</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', alignContent: 'center', gap: '5px 0', padding: '7px 4px' }}>
          {bits.map(b => (
            <div key={b.k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, color: b.c, lineHeight: 1 }}>{b.k}</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13.5, color: 'var(--text)', lineHeight: 1 }}>{b.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Month divider ─────────────────────────────────────────────────────────────

function MonthDivider({ label, stickyTop }) {
  return (
    <div style={{
      position: 'sticky',
      top: stickyTop,
      zIndex: 16,
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0 8px',
      marginTop: 20,
    }}>
      <div style={{ height: 1, background: W_FAINT, flex: '0 0 12px' }} />
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--sub)', whiteSpace: 'nowrap' }}>
        {label.toUpperCase()}
      </span>
      <div style={{ height: 1, background: W_FAINT, flex: 1 }} />
    </div>
  )
}

// ── Game card ─────────────────────────────────────────────────────────────────

function GameCard({ game, open, onToggle, onEdit, onDelete, vsResult, isPB, preview = 'frames' }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const timeStr = new Date(game.played_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const frames = game.frames ?? []
  const stats = computeStats(frames)

  const result = vsResult?.result
  const perfect = game.total_score === 300
  const edited = !!game.ai_frames

  const accent = perfect ? AMBER : result === 'W' ? 'var(--win)' : result === 'L' ? 'var(--loss)' : W_LINE
  const scoreColor = perfect ? AMBER : result === 'W' ? 'var(--win)' : result === 'L' ? 'var(--loss)' : 'var(--text)'

  let ledger = null
  if (perfect) {
    ledger = (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: AMBER }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" /></svg>
        PERFECT GAME
      </span>
    )
  } else if (vsResult) {
    const won = result === 'W'
    const diff = Math.abs((game.total_score ?? 0) - (vsResult.oppScore ?? 0))
    ledger = (
      <span style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
        <strong style={{ color: won ? 'var(--win)' : 'var(--loss)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>{won ? 'WON' : 'LOST'}</strong>
        <span style={{ color: 'var(--sub)' }}> by {diff} · vs </span>
        <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{vsResult.opponentName}</strong>
      </span>
    )
  } else if (isPB) {
    ledger = (
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', color: AMBER }}>★ PERSONAL BEST</span>
    )
  } else if (edited) {
    ledger = (
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--spare)' }}>EDITED</span>
    )
  }

  const cardStyle = perfect ? {
    background: 'linear-gradient(180deg,#FBF1D6 0%,#FBF5E8 55%)',
    border: '1px solid rgba(190,124,42,0.45)',
    boxShadow: '0 1px 2px rgba(60,40,15,0.06), 0 8px 22px -10px rgba(190,124,42,0.45)',
  } : {
    background: W_CARD,
    border: `1px solid ${W_LINE}`,
    boxShadow: '0 1px 2px rgba(60,40,15,0.06), 0 6px 16px -10px rgba(60,40,15,0.25)',
  }

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

  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', ...cardStyle }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accent }} />
      <div style={{ padding: '13px 15px 13px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
          <div onClick={onToggle} style={{ flex: '0 0 auto', cursor: 'pointer', minWidth: 58 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 40, lineHeight: 0.85, letterSpacing: '-0.03em', color: scoreColor }}>
              {game.total_score}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--sub)' }}>
              <span>{timeStr}</span>
              {game.player_label && (
                <span style={{ padding: '1px 5px', borderRadius: 4, background: 'rgba(206,27,14,0.1)', color: 'var(--accent)', fontWeight: 700 }}>
                  {game.player_label}
                </span>
              )}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 20, marginBottom: 8 }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ledger}</span>
              <button
                onClick={onToggle}
                style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, border: `1px solid ${W_LINE}`, background: W_INSET, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--sub)" strokeWidth="2.5" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
            <div onClick={onToggle} style={{ cursor: 'pointer', marginTop: 1 }}>
              {open || preview === 'summary'
                ? <StatStrip stats={stats} compact />
                : <MarksStrip frames={frames} />
              }
            </div>
          </div>
        </div>
        {open && (
          <div style={{ marginTop: 13, paddingTop: 13, borderTop: `1px solid ${W_FAINT}` }}>
            <MiniGrid frames={frames} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {confirmDelete ? (
                <>
                  <button onClick={handleDelete} style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', background: 'var(--loss)', color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    Confirm Delete
                  </button>
                  <button onClick={handleCancelDelete} style={{ flex: 1, height: 38, borderRadius: 10, border: `1px solid ${W_LINE}`, background: 'transparent', color: 'var(--sub)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleEdit} style={{ flex: 1, height: 38, borderRadius: 10, border: `1px solid ${W_LINE}`, background: 'transparent', color: 'var(--text)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    Edit
                  </button>
                  <button onClick={handleDelete} style={{ width: 42, height: 38, borderRadius: 10, border: `1px solid ${W_LINE}`, background: 'transparent', color: 'var(--sub)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Day section ───────────────────────────────────────────────────────────────

function DaySection({ date, games, openGameId, onToggleGame, onEditGame, onDeleteGame, getVsResult, pbSet, preview, dayTop }) {
  const today = new Date()
  const isToday = today.toDateString() === date.toDateString()
  const label = isToday
    ? 'Today'
    : date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div>
      <DayHeader label={label} games={games} stickyTop={dayTop} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {games.map(game => (
          <GameCard
            key={game.id}
            game={game}
            open={openGameId === game.id}
            onToggle={() => onToggleGame(game.id)}
            onEdit={onEditGame}
            onDelete={onDeleteGame}
            vsResult={getVsResult?.(game)}
            isPB={pbSet?.has(game.id)}
            preview={preview}
          />
        ))}
      </div>
    </div>
  )
}

// ── Date jump popover ─────────────────────────────────────────────────────────

function DateJumpPopover({ availableMonths, loadedMonths, onJump, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-full z-50 mt-2 rounded-xl overflow-hidden"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-float)',
          width: 188,
          maxHeight: 300,
          overflowY: 'auto',
        }}
      >
        <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sub)' }}>
          Jump to Month
        </p>
        {availableMonths.length === 0 && (
          <p className="px-3 pb-3 text-xs" style={{ color: 'var(--sub)' }}>No months available</p>
        )}
        {availableMonths.map(key => {
          const [year, month] = key.split('-').map(Number)
          const label = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          const loaded = loadedMonths.has(key)
          return (
            <button
              key={key}
              onClick={() => onJump(key)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-sm"
              style={{ color: 'var(--text)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: 13 }}>{label}</span>
              {!loaded && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--sub)', marginLeft: 6, flexShrink: 0 }}>↓</span>
              )}
            </button>
          )
        })}
        <div style={{ height: 6 }} />
      </div>
    </>
  )
}

// ── Upload modal ──────────────────────────────────────────────────────────────

export function UploadModal({ session, profile, onClose, onSaved }) {
  const [phase, setPhase] = useState('input')
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [playerLabel, setPlayerLabel] = useState(() => {
    const prefs = loadUploadPrefs()
    return prefs?.myPlayerLabel ?? profile?.player_label ?? ''
  })
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
      const scoredFrames = computeScores(normalizeFrames(result.frames))
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
      await supabase.from('profiles').update({ player_label: playerLabel.trim() }).eq('id', session.user.id)
    }

    const framesEdited = JSON.stringify(parsedData.frames) !== JSON.stringify(aiFrames)
    const { data, error: saveErr } = await supabase
      .from('games')
      .insert({
        user_id: session.user.id,
        played_at: new Date(playedAt).toISOString(),
        total_score: totalScore,
        player_label: playerLabel.trim(),
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

    saveUploadPrefs({ myPlayerLabel: playerLabel.trim() })
    onSaved(data)
    onClose()
  }

  const isParsing = phase === 'parsing'
  const isSaving = phase === 'saving'
  const isReview = phase === 'review'
  const totalScore = parsedData?.frames[9]?.runningScore ?? 0

  return (
    <ModalShell title="Upload Game" onClose={onClose}>
      {previewUrl ? (
        <div className="relative mb-4">
          <img src={previewUrl} alt="Scorecard preview" className="h-40 w-full rounded-xl object-cover" />
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
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl py-5 transition-colors"
            style={{ border: '2px dashed var(--border)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 50%, transparent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--sub)', opacity: 0.5 }}>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className="text-xs font-medium" style={{ color: 'var(--sub)' }}>Take Photo</span>
          </button>
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl py-5 transition-colors"
            style={{ border: '2px dashed var(--border)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 50%, transparent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--sub)', opacity: 0.5 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="text-xs font-medium" style={{ color: 'var(--sub)' }}>Choose Photo</span>
          </button>
        </div>
      )}

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      <div className="mb-3 space-y-2">
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--sub)' }}>Your label on screen</label>
          <LabelChip value={playerLabel} onChange={setPlayerLabel} placeholder="A" />
        </div>
        <DateTimeDisclosure playedAt={playedAt} setPlayedAt={setPlayedAt} />
      </div>

      {error && (
        <p className="mb-3 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: 'color-mix(in srgb, var(--loss) 12%, transparent)', color: 'var(--loss)' }}>
          {error}
        </p>
      )}

      {isReview && parsedData && (
        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Review &amp; edit before saving</span>
            <span className="text-[10px]" style={{ color: 'var(--sub)' }}>Tap any ball to edit</span>
          </div>
          <div className="mb-3 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--elevated)' }}>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-3xl" style={{ color: 'var(--text)' }}>{totalScore}</span>
              <span className="text-sm" style={{ color: 'var(--sub)' }}>total</span>
            </div>
            <StatTable strikes={parsedData.strikes} spares={parsedData.spares} opens={parsedData.opens} initialRun={parsedData.initialRun} frames={parsedData.frames} />
          </div>
          <EditableFrameGrid frames={parsedData.frames} onChange={handleFramesChange} />
        </div>
      )}

      {!isReview ? (
        <button
          onClick={handleParse}
          disabled={isParsing || isSaving}
          className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--acc-text)' }}
        >
          {isParsing ? 'Parsing photo…' : 'Parse Score'}
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setPhase('input')}
            disabled={isSaving}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ border: '1px solid var(--border)', color: 'var(--sub)' }}
          >
            Retake
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--acc-text)' }}
          >
            {isSaving ? 'Saving…' : 'Save Game'}
          </button>
        </div>
      )}
    </ModalShell>
  )
}

// ── Edit game modal ───────────────────────────────────────────────────────────

function EditGameModal({ game, onClose, onSaved }) {
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

    const { data: savedGame, error: saveErr } = await supabase
      .from('games')
      .update({
        played_at: new Date(playedAt).toISOString(),
        total_score: totalScore,
        player_label: playerLabel.trim(),
        frames,
        ...(shouldSetAiFrames ? { ai_frames: originalFrames } : {}),
      })
      .eq('id', game.id)
      .select()
      .single()

    if (saveErr) { setError('Failed to save. ' + saveErr.message); setSaving(false); return }
    if (!savedGame) { setError('Save failed — game not found or permission denied.'); setSaving(false); return }

    onSaved(savedGame)
    onClose()
  }

  return (
    <ModalShell title="Edit Game" onClose={onClose}>
      <div className="mb-3 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--elevated)' }}>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-3xl" style={{ color: 'var(--text)' }}>{totalScore}</span>
          <span className="text-sm" style={{ color: 'var(--sub)' }}>total</span>
        </div>
        <StatTable strikes={stats.strikes} spares={stats.spares} opens={stats.opens} initialRun={stats.initialRun} frames={frames} />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--sub)' }}>Player label</label>
          <ThemedInput type="text" value={playerLabel} onChange={e => setPlayerLabel(e.target.value.toUpperCase())} placeholder="A" maxLength={3} className="font-mono uppercase" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--sub)' }}>Date &amp; time played</label>
          <ThemedInput type="datetime-local" value={playedAt} onChange={e => setPlayedAt(e.target.value)} />
        </div>
      </div>

      <div className="mb-3">
        <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text)' }}>
          Frames <span className="font-normal" style={{ color: 'var(--sub)' }}>(scores update automatically)</span>
        </p>
        <EditableFrameGrid frames={frames} onChange={handleFramesChange} />
      </div>

      {error && (
        <p className="mb-3 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: 'color-mix(in srgb, var(--loss) 12%, transparent)', color: 'var(--loss)' }}>
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button onClick={onClose} disabled={saving} className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-50" style={{ border: '1px solid var(--border)', color: 'var(--sub)' }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50" style={{ background: 'var(--accent)', color: 'var(--acc-text)' }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </ModalShell>
  )
}

// ── Legend popover ────────────────────────────────────────────────────────────

function LegendPopover({ onClose }) {
  const rows = [
    { symbol: 'X',  symbolStyle: { color: 'var(--strike)', fontWeight: 700 }, label: 'Strikes' },
    { symbol: '/',  symbolStyle: { color: 'var(--spare)',  fontWeight: 700 }, label: 'Spares' },
    { symbol: '-',  symbolStyle: { color: 'var(--sub)' },                    label: 'Opens' },
    { symbol: '#',  symbolStyle: { color: 'var(--sub)' },                    label: 'Strikes to Start' },
    { symbol: 'S',  symbolStyle: { color: 'var(--sub)' },                    label: 'Splits' },
    { symbol: 'S/', symbolStyle: { color: 'var(--sub)' },                    label: 'Converted Splits' },
  ]
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl p-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}
      >
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sub)' }}>Summary Legend</p>
        <div className="space-y-2.5">
          {rows.map(r => (
            <div key={r.symbol} className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-center text-sm" style={r.symbolStyle}>{r.symbol}</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}`
}

function monthKeyToDate(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 1)
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyGames({ session, refreshKey = 0, onOpenUpload, cardPreview = 'frames' }) {
  // Lightweight metadata for ALL games — used for ribbon stats and PB set.
  // Does not include frames JSON, so it's fast even with thousands of games.
  const [allMeta, setAllMeta] = useState([])

  // Full game data for the "All Time" lazy-loaded feed (grows as months load).
  const [allTimeGames, setAllTimeGames] = useState([])

  // Full game data for bounded filtered views (year / 3mo / 30d).
  const [filterGames, setFilterGames] = useState([])

  // Which 'YYYY-M' month keys have been fully fetched into allTimeGames.
  const [loadedMonths, setLoadedMonths] = useState(new Set())

  const [loadingMore, setLoadingMore] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [filterLoading, setFilterLoading] = useState(false)

  const [vsMatchMap, setVsMatchMap] = useState({})
  const [vsOpponentGameMap, setVsOpponentGameMap] = useState({})

  const [editingGame, setEditingGame] = useState(null)
  const [openGameId, setOpenGameId] = useState(null)
  const [timeFilter, setTimeFilter] = useState(() => localStorage.getItem('ss_time_filter') ?? 'all')
  const [showLegend, setShowLegend] = useState(false)
  const [showDateJump, setShowDateJump] = useState(false)

  const sentinelRef = useRef(null)
  const mainHeaderRef = useRef(null)
  const [mainHeaderH, setMainHeaderH] = useState(0)
  // Refs for stable observer callbacks (avoids stale closures)
  const loadingMoreRef = useRef(false)
  const loadNextMonthRef = useRef(null)

  useEffect(() => { loadingMoreRef.current = loadingMore }, [loadingMore])

  // Track the sticky main header's height so month/day headers stack correctly below it
  useEffect(() => {
    const el = mainHeaderRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setMainHeaderH(entries[0].contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const monthTop = FIXED_H + mainHeaderH
  const dayTop   = monthTop + MONTH_DIVIDER_H

  // The games shown in the feed
  const displayGames = timeFilter === 'all' ? allTimeGames : filterGames

  // Months that have at least one game, sorted newest-first: ['2025-5', '2025-4', ...]
  const availableMonths = useMemo(() => {
    const seen = new Set()
    allMeta.forEach(g => seen.add(monthKey(new Date(g.played_at))))
    return [...seen].sort((a, b) => {
      const [ay, am] = a.split('-').map(Number)
      const [by, bm] = b.split('-').map(Number)
      return by !== ay ? by - ay : bm - am
    })
  }, [allMeta])

  // The next month (by date, going backwards) that hasn't been fetched yet
  const nextMonthToLoad = useMemo(
    () => availableMonths.find(m => !loadedMonths.has(m)) ?? null,
    [availableMonths, loadedMonths]
  )

  // ── Fetch helpers ────────────────────────────────────────────────────────────

  async function fetchAllMeta() {
    const { data } = await supabase
      .from('games')
      .select('id, total_score, played_at, is_vs, vs_match_id, frames')
      .eq('user_id', session.user.id)
      .order('played_at', { ascending: false })
    return data ?? []
  }

  async function fetchMonthGames(year, month) {
    const start = new Date(year, month, 1).toISOString()
    const end   = new Date(year, month + 1, 1).toISOString()
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('played_at', start)
      .lt('played_at', end)
      .order('played_at', { ascending: false })
    return data ?? []
  }

  async function fetchFilteredGames(filter) {
    const now = new Date()
    let query = supabase.from('games').select('*').eq('user_id', session.user.id).order('played_at', { ascending: false })
    if (filter === 'year') query = query.gte('played_at', new Date(now.getFullYear(), 0, 1).toISOString())
    else if (filter === '3mo') query = query.gte('played_at', new Date(now - 90 * 86400000).toISOString())
    else if (filter === '30d') query = query.gte('played_at', new Date(now - 30 * 86400000).toISOString())
    const { data } = await query
    return data ?? []
  }

  async function loadVsDataForGames(newGames) {
    const vsGames = newGames.filter(g => g.is_vs && g.vs_match_id)
    if (!vsGames.length) return

    const vsMatchIds = [...new Set(vsGames.map(g => g.vs_match_id))]
    const { data: vsData } = await supabase
      .from('vs_matches')
      .select('id, submitter_id, opponent_id, submitter_game_id, opponent_game_id')
      .in('id', vsMatchIds)
    if (!vsData?.length) return

    const newMatchMap = {}
    vsData.forEach(m => { newMatchMap[m.id] = m })

    const opponentIds = [...new Set(vsData.map(m =>
      m.submitter_id === session.user.id ? m.opponent_id : m.submitter_id
    ))]
    const opponentGameIds = vsGames.map(g => {
      const m = newMatchMap[g.vs_match_id]
      if (!m) return null
      return g.user_id === m.submitter_id ? m.opponent_game_id : m.submitter_game_id
    }).filter(Boolean)

    const [profilesRes, oppGamesRes] = await Promise.all([
      opponentIds.length > 0
        ? supabase.from('profiles').select('id, display_name, email').in('id', opponentIds)
        : Promise.resolve({ data: [] }),
      opponentGameIds.length > 0
        ? supabase.from('games').select('id, user_id, total_score').in('id', opponentGameIds)
        : Promise.resolve({ data: [] }),
    ])

    const profileMap = Object.fromEntries((profilesRes.data ?? []).map(p => [p.id, p]))
    vsData.forEach(m => {
      m.submitterProfile = profileMap[m.submitter_id] ?? { id: m.submitter_id }
      m.opponentProfile  = profileMap[m.opponent_id]  ?? { id: m.opponent_id }
    })

    setVsMatchMap(prev => ({ ...prev, ...newMatchMap }))
    const oppMap = {}
    oppGamesRes.data?.forEach(g => { oppMap[g.id] = g })
    setVsOpponentGameMap(prev => ({ ...prev, ...oppMap }))
  }

  // ── Initial load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    setInitialLoading(true)
    setAllTimeGames([])
    setFilterGames([])
    setLoadedMonths(new Set())
    setVsMatchMap({})
    setVsOpponentGameMap({})

    async function init() {
      const meta = await fetchAllMeta()
      setAllMeta(meta)

      // Seed with every calendar month that overlaps the last 30 days.
      // On June 1 this gives May + June, so games from late May appear immediately.
      const now = new Date()
      const cutoff = new Date(now - 30 * 86400000)
      const keysToLoad = new Set()
      let cursor = new Date(cutoff.getFullYear(), cutoff.getMonth(), 1)
      while (cursor <= now) {
        keysToLoad.add(monthKey(cursor))
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
      }

      const fetched = await Promise.all(
        [...keysToLoad].map(key => {
          const [y, m] = key.split('-').map(Number)
          return fetchMonthGames(y, m)
        })
      )
      const monthGames = fetched.flat().sort((a, b) => new Date(b.played_at) - new Date(a.played_at))

      setAllTimeGames(monthGames)
      setLoadedMonths(keysToLoad)
      setInitialLoading(false)

      await loadVsDataForGames(monthGames)
    }

    init()
  }, [refreshKey])

  // ── Filter change: fetch bounded sets server-side ────────────────────────────

  useEffect(() => {
    if (timeFilter === 'all') return
    setFilterLoading(true)
    setFilterGames([])

    fetchFilteredGames(timeFilter).then(async games => {
      setFilterGames(games)
      setFilterLoading(false)
      await loadVsDataForGames(games)
    })
  }, [timeFilter])

  // ── Load next month (called by sentinel observer) ────────────────────────────

  async function loadNextMonth() {
    if (!nextMonthToLoad || loadingMoreRef.current) return
    setLoadingMore(true)

    const [y, m] = nextMonthToLoad.split('-').map(Number)
    const monthGames = await fetchMonthGames(y, m)

    setAllTimeGames(prev => [...prev, ...monthGames])
    setLoadedMonths(prev => new Set([...prev, nextMonthToLoad]))
    setLoadingMore(false)

    if (monthGames.length > 0) await loadVsDataForGames(monthGames)
  }

  // Keep ref current so the observer callback always calls the latest version
  loadNextMonthRef.current = loadNextMonth

  // ── IntersectionObserver sentinel ────────────────────────────────────────────

  useEffect(() => {
    if (timeFilter !== 'all') return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingMoreRef.current) {
        loadNextMonthRef.current?.()
      }
    }, { threshold: 0.1, rootMargin: '120px' })

    observer.observe(el)
    return () => observer.disconnect()
  // Re-run when nextMonthToLoad changes (new month unlocked) or filter switches
  }, [timeFilter, nextMonthToLoad])

  // ── Date jump ────────────────────────────────────────────────────────────────

  async function jumpToMonth(key) {
    setShowDateJump(false)

    // Switch to all-time feed
    setTimeFilter('all')
    localStorage.setItem('ss_time_filter', 'all')
    setOpenGameId(null)

    // Determine which months need to be loaded to reach the target.
    // Load everything from the oldest currently-loaded month back to the target.
    const needed = availableMonths.filter(m => {
      if (loadedMonths.has(m)) return false
      const mTime = monthKeyToDate(m).getTime()
      const tTime = monthKeyToDate(key).getTime()
      return mTime >= tTime // at-or-newer than target, so we fill the gap
    })

    // Load sequentially (newest-first from the filtered list)
    const newlyLoaded = new Set(loadedMonths)
    for (const m of needed) {
      const [y, mo] = m.split('-').map(Number)
      const monthGames = await fetchMonthGames(y, mo)
      setAllTimeGames(prev => [...prev, ...monthGames])
      newlyLoaded.add(m)
      setLoadedMonths(new Set(newlyLoaded))
      if (monthGames.length > 0) await loadVsDataForGames(monthGames)
    }

    setTimeout(() => {
      const el = document.getElementById(`month-${key}`)
      if (el) {
        // 56px fixed header (h-14) + 12px breathing room so the month label is visible
        const top = el.getBoundingClientRect().top + window.scrollY - 68
        window.scrollTo({ top, behavior: 'smooth' })
      }
    }, 120)
  }

  // ── CRUD helpers ─────────────────────────────────────────────────────────────

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
    const result = game.total_score > oppGame.total_score ? 'W' : game.total_score < oppGame.total_score ? 'L' : 'T'
    return { result, opponentName: oppName, opponentId: opponentProfile?.id, myScore: game.total_score, oppScore: oppGame.total_score }
  }

  function toggleGame(id) {
    setOpenGameId(prev => prev === id ? null : id)
  }

  function changeTimeFilter(value) {
    setTimeFilter(value)
    localStorage.setItem('ss_time_filter', value)
    setOpenGameId(null)
  }

  function handleGameUpdated(updatedGame) {
    const patch = g => g.id === updatedGame.id ? updatedGame : g
    setAllTimeGames(prev => prev.map(patch))
    setFilterGames(prev => prev.map(patch))
    setAllMeta(prev => prev.map(g =>
      g.id === updatedGame.id
        ? { ...g, total_score: updatedGame.total_score, played_at: updatedGame.played_at }
        : g
    ))
  }

  async function handleDeleteGame(id) {
    const { error } = await supabase.from('games').delete().eq('id', id).eq('user_id', session.user.id)
    if (!error) {
      setAllTimeGames(prev => prev.filter(g => g.id !== id))
      setFilterGames(prev => prev.filter(g => g.id !== id))
      setAllMeta(prev => prev.filter(g => g.id !== id))
      if (openGameId === id) setOpenGameId(null)
    }
  }

  // ── Computed: ribbon stats ────────────────────────────────────────────────────

  const ribbonStats = useMemo(() => {
    if (timeFilter === 'all') {
      if (!allMeta.length) return null
      const scores = allMeta.map(g => g.total_score ?? 0)
      return {
        total: allMeta.length,
        avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
        bestScore: Math.max(...scores),
        perfectCount: allMeta.filter(g => g.total_score === 300).length,
        totalStrikes: allMeta.reduce((s, g) => s + computeStats(g.frames ?? []).strikes, 0),
      }
    }
    if (!filterGames.length) return null
    const scores = filterGames.map(g => g.total_score ?? 0)
    return {
      total: filterGames.length,
      avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      bestScore: Math.max(...scores),
      perfectCount: filterGames.filter(g => g.total_score === 300).length,
      totalStrikes: filterGames.reduce((s, g) => s + computeStats(g.frames ?? []).strikes, 0),
    }
  }, [timeFilter, allMeta, filterGames])

  // ── Computed: PB set (all-time, chronological) ────────────────────────────────

  const pbSet = useMemo(() => {
    const sorted = [...allMeta].sort((a, b) => new Date(a.played_at) - new Date(b.played_at))
    let max = -1
    const pbs = new Set()
    for (const g of sorted) {
      if ((g.total_score ?? 0) > max && g.total_score !== 300) {
        max = g.total_score
        pbs.add(g.id)
      }
    }
    return pbs
  }, [allMeta])

  // ── Computed: group display games by day, then by month ───────────────────────

  const daysByMonth = useMemo(() => {
    // Group into days
    const dayMap = {}
    displayGames.forEach(game => {
      const key = new Date(game.played_at).toDateString()
      if (!dayMap[key]) dayMap[key] = { date: new Date(game.played_at), games: [] }
      dayMap[key].games.push(game)
    })
    const allDays = Object.values(dayMap).sort((a, b) => b.date - a.date)

    // Group days into months
    const monthMap = {}
    allDays.forEach(day => {
      const key = monthKey(day.date)
      if (!monthMap[key]) {
        monthMap[key] = {
          key,
          label: day.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          dayGroups: [],
        }
      }
      monthMap[key].dayGroups.push(day)
    })

    return Object.values(monthMap).sort((a, b) => {
      const [ay, am] = a.key.split('-').map(Number)
      const [by, bm] = b.key.split('-').map(Number)
      return by !== ay ? by - ay : bm - am
    })
  }, [displayGames])

  const sharedProps = {
    openGameId,
    onToggleGame: toggleGame,
    onEditGame: setEditingGame,
    onDeleteGame: handleDeleteGame,
    getVsResult,
    pbSet,
    preview: cardPreview,
    dayTop,
  }

  const hasAnyGames = allMeta.length > 0
  const isLoading = initialLoading
  const isFilterLoading = filterLoading && timeFilter !== 'all'

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-0">

      {/* ── Sticky main header ── */}
      <div
        ref={mainHeaderRef}
        style={{
          position: 'sticky',
          top: FIXED_H,
          zIndex: 18,
          background: 'var(--bg)',
          paddingBottom: 8,
        }}
      >

      {/* Time filter pills + date-jump + legend */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex flex-1 gap-1 rounded-xl p-1" style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>
          {TIME_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => changeTimeFilter(f.key)}
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

        {/* Date jump */}
        <div className="relative shrink-0">
          <button
            onClick={() => { setShowDateJump(v => !v); setShowLegend(false) }}
            title="Jump to month"
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: showDateJump ? '1px solid var(--accent)' : `1px solid ${W_LINE}`,
              background: showDateJump ? 'var(--accent)' : 'transparent',
              color: showDateJump ? 'var(--acc-text)' : 'var(--sub)',
              display: 'grid', placeItems: 'center', cursor: 'pointer',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
          {showDateJump && (
            <DateJumpPopover
              availableMonths={availableMonths}
              loadedMonths={loadedMonths}
              onJump={jumpToMonth}
              onClose={() => setShowDateJump(false)}
            />
          )}
        </div>

        {/* Legend */}
        <div className="relative shrink-0">
          <button
            onClick={() => { setShowLegend(v => !v); setShowDateJump(false) }}
            title="Score summary legend"
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: showLegend ? '1px solid var(--accent)' : `1px solid ${W_LINE}`,
              background: showLegend ? 'var(--accent)' : 'transparent',
              color: showLegend ? 'var(--acc-text)' : 'var(--sub)',
              display: 'grid', placeItems: 'center',
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12,
              cursor: 'pointer',
            }}
          >?</button>
          {showLegend && <LegendPopover onClose={() => setShowLegend(false)} />}
        </div>
      </div>

      {/* Ribbon stats */}
      {!isLoading && ribbonStats && (
        <div style={{ margin: '15px 0 0', display: 'flex', border: `1px solid ${W_HARD}`, borderRadius: 12, overflow: 'hidden', background: W_CARD, boxShadow: '0 1px 2px rgba(60,40,15,0.05)' }}>
          {[
            { k: 'GAMES',   v: ribbonStats.total,        badge: null },
            { k: 'AVG',     v: ribbonStats.avgScore,     badge: null },
            { k: 'BEST',    v: ribbonStats.bestScore,    badge: ribbonStats.perfectCount > 1 ? ribbonStats.perfectCount : null },
            { k: 'STRIKES', v: ribbonStats.totalStrikes, badge: null },
          ].map((r, i) => (
            <div key={r.k} style={{ flex: 1, padding: '10px 0 11px', textAlign: 'center', borderLeft: i ? `1px solid ${W_FAINT}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, lineHeight: 1 }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', color: r.k === 'BEST' && r.v === 300 ? AMBER : 'var(--text)' }}>
                  {r.v}
                </span>
                {r.badge && (
                  <span title={`${r.badge} perfect games logged`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 700, color: AMBER, background: 'rgba(190,124,42,0.14)', border: '1px solid rgba(190,124,42,0.32)', borderRadius: 999, padding: '1px 5px 1px 4px' }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" /></svg>
                    {r.badge}
                  </span>
                )}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--sub)', marginTop: 4 }}>{r.k}</div>
            </div>
          ))}
        </div>
      )}

      </div>{/* end sticky main header */}

      {/* Game list */}
      {isLoading ? (
        <div className="flex justify-center py-16 text-sm" style={{ color: 'var(--sub)' }}>Loading games…</div>
      ) : !hasAnyGames ? (
        <div className="flex flex-col items-center justify-center rounded-2xl py-16 mt-6" style={{ border: '2px dashed var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--sub)' }}>No games recorded yet</p>
          <p className="mt-1 text-xs" style={{ color: 'color-mix(in srgb, var(--sub) 60%, transparent)' }}>
            Upload a photo of your scorecard to get started
          </p>
          {onOpenUpload && (
            <button onClick={onOpenUpload} className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-[0.98]" style={{ background: 'var(--accent)', color: 'var(--acc-text)' }}>
              Upload your first game
            </button>
          )}
        </div>
      ) : isFilterLoading ? (
        <div className="flex justify-center py-16 text-sm" style={{ color: 'var(--sub)' }}>Loading…</div>
      ) : displayGames.length === 0 ? (
        <div className="flex justify-center py-10 text-sm mt-6" style={{ color: 'var(--sub)' }}>
          No games in this period
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {daysByMonth.map(({ key, label, dayGroups }, mi) => (
            <div key={key} id={`month-${key}`}>
              <MonthDivider label={label} stickyTop={monthTop} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {dayGroups.map(({ date, games: dayGames }) => (
                  <DaySection
                    key={date.toDateString()}
                    date={date}
                    games={dayGames}
                    {...sharedProps}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Infinite scroll sentinel — only in all-time mode */}
          {timeFilter === 'all' && (
            <div ref={sentinelRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 56, marginTop: 8 }}>
              {loadingMore && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--sub)' }}>
                  LOADING…
                </span>
              )}
              {!loadingMore && !nextMonthToLoad && allMeta.length > 0 && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: W_FAINT }}>
                  ALL GAMES LOADED
                </span>
              )}
            </div>
          )}
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
