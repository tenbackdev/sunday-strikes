import { useRef } from 'react'
import { isConvertedSplit } from '../lib/parseGame'

// ── Ball mark (display only) ─────────────────────────────────────────────────

export function BallMark({ value }) {
  if (value === 'X') return <span className="font-bold" style={{ color: 'var(--strike)' }}>X</span>
  if (value === '/') return <span className="font-bold" style={{ color: 'var(--spare)' }}>/</span>
  if (value === '-') return <span style={{ color: 'var(--sub)' }}>-</span>
  return <span style={{ color: 'var(--text)' }}>{value}</span>
}

// ── Editable ball input ──────────────────────────────────────────────────────

export function EditableBallInput({ value, onChange, disabled }) {
  const inputRef = useRef(null)

  const inputStyle =
    value === 'X' ? { color: 'var(--strike)', borderColor: 'color-mix(in srgb, var(--strike) 30%, transparent)', background: 'color-mix(in srgb, var(--strike) 10%, transparent)' } :
    value === '/' ? { color: 'var(--spare)',  borderColor: 'color-mix(in srgb, var(--spare) 30%, transparent)',  background: 'color-mix(in srgb, var(--spare) 10%, transparent)' } :
    value === '-' ? { color: 'var(--sub)',    borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--elevated) 60%, transparent)' } :
                    { color: 'var(--text)',   borderColor: 'var(--border)', background: 'var(--elevated)' }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value ?? ''}
      disabled={disabled}
      data-ball-input
      onFocus={e => e.target.select()}
      onChange={e => {
        let raw = e.target.value.toUpperCase()
        if (raw === '0') raw = '-'
        else if (raw === '10') raw = 'X'
        else raw = raw.slice(-1)
        if (raw === '' || /^[X/\-1-9]$/.test(raw)) {
          onChange(raw)
          if (/^[X/\-1-9]$/.test(raw)) {
            const grid = inputRef.current?.closest('[data-frame-grid]')
            const all = Array.from(grid?.querySelectorAll('[data-ball-input]:not([disabled])') ?? [])
            const idx = all.indexOf(inputRef.current)
            if (idx >= 0 && idx < all.length - 1) all[idx + 1].focus()
          }
        }
      }}
      className="rounded border text-center text-xs font-bold outline-none transition-colors"
      style={{
        width: '30px',
        height: '30px',
        ...inputStyle,
        opacity: disabled ? 0.25 : 1,
        cursor: disabled ? 'not-allowed' : 'text',
      }}
    />
  )
}

// ── Stat table ───────────────────────────────────────────────────────────────

export function StatTable({ strikes, spares, opens, initialRun, frames }) {
  const splits = frames?.filter(f => f?.split).length ?? 0
  const converted = frames?.filter(f => isConvertedSplit(f)).length ?? 0
  const cols = [
    { header: 'X',  headerStyle: { color: 'var(--strike)', fontWeight: 700 }, value: strikes },
    { header: '/',  headerStyle: { color: 'var(--spare)',  fontWeight: 700 }, value: spares },
    { header: '-',  headerStyle: { color: 'var(--sub)',    fontWeight: 500 }, value: opens },
    { header: '#',  headerStyle: { color: 'var(--sub)',    fontWeight: 500 }, value: initialRun },
    { header: 'S',  headerStyle: { color: 'var(--sub)',    fontWeight: 500 }, value: splits },
    { header: 'S/', headerStyle: { color: 'var(--sub)',    fontWeight: 500 }, value: converted },
  ]
  return (
    <div className="grid grid-cols-6 gap-x-1 text-center">
      {cols.map(c => (
        <div key={c.header} className="text-[10px] leading-tight" style={c.headerStyle}>{c.header}</div>
      ))}
      {cols.map(c => (
        <div key={`v-${c.header}`} className="text-sm font-semibold leading-tight" style={{ color: 'var(--text)' }}>{c.value}</div>
      ))}
    </div>
  )
}

// ── Scorecard frame grid (read-only) ─────────────────────────────────────────

export function FrameGrid({ frames }) {
  const borderStyle = '1px solid color-mix(in srgb, var(--border) 60%, transparent)'

  return (
    <div className="overflow-x-auto">
      <div
        className="flex w-max rounded-lg mx-auto"
        style={{ border: borderStyle }}
      >
        {frames.map((frame) => {
          const isTenth = frame.frame === 10
          const hasSplit = !!frame.split
          const splitBallIdx = isTenth && frame.balls[0] === 'X' ? 1 : 0
          const sb = (val, idx) => hasSplit && idx === splitBallIdx ? (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full"
              style={{ border: '1px solid var(--loss)' }}>
              <BallMark value={val} />
            </span>
          ) : <BallMark value={val} />

          return (
            <div
              key={frame.frame}
              className={`flex flex-col text-center ${isTenth ? 'w-[4.5rem]' : 'w-10'}`}
              style={{ borderRight: borderStyle }}
            >
              <div className="flex items-center justify-center py-0.5" style={{ borderBottom: borderStyle }}>
                <span className="text-[10px] font-medium" style={{ color: 'var(--sub)' }}>{frame.frame}</span>
              </div>
              <div className="flex h-7 text-xs" style={{ borderBottom: borderStyle }}>
                {isTenth ? (
                  <>
                    <div className="flex-1 flex items-center justify-center" style={{ borderRight: borderStyle }}>{sb(frame.balls[0] ?? '', 0)}</div>
                    <div className="flex-1 flex items-center justify-center" style={{ borderRight: borderStyle }}>{frame.balls[1] != null && sb(frame.balls[1], 1)}</div>
                    <div className="flex-1 flex items-center justify-center">
                      {(frame.balls[0] === 'X' || frame.balls[1] === '/') && frame.balls[2] != null && <BallMark value={frame.balls[2]} />}
                    </div>
                  </>
                ) : frame.balls[0] === 'X' ? (
                  <div className="flex-1 flex items-center justify-center"><BallMark value="X" /></div>
                ) : (
                  <>
                    <div className="flex-1 flex items-center justify-center" style={{ borderRight: borderStyle }}>{sb(frame.balls[0] ?? '', 0)}</div>
                    <div className="flex-1 flex items-center justify-center">{frame.balls[1] != null && <BallMark value={frame.balls[1]} />}</div>
                  </>
                )}
              </div>
              <div className="py-1.5 text-xs font-semibold" style={{ color: 'var(--text)' }}>{frame.runningScore}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Editable frame grid ──────────────────────────────────────────────────────

export function EditableFrameGrid({ frames, onChange }) {
  const cachedFillBallRef = useRef(null)
  const borderStyle = '1px solid color-mix(in srgb, var(--border) 60%, transparent)'

  function applyAutoSpare(balls, ballIdx, val) {
    if (ballIdx === 1 && val !== '/' && val !== 'X' && val !== '-') {
      const b1 = balls[0]
      if (b1 !== 'X' && b1 !== '/' && b1 !== '-') {
        const pins1 = parseInt(b1, 10)
        const pins2 = parseInt(val, 10)
        if (!isNaN(pins1) && !isNaN(pins2) && pins1 + pins2 === 10) return '/'
      }
    }
    if (ballIdx === 2 && val !== '/' && val !== 'X' && val !== '-') {
      const b2 = balls[1]
      if (b2 !== 'X' && b2 !== '/' && b2 !== '-') {
        const pins2 = parseInt(b2, 10)
        const pins3 = parseInt(val, 10)
        if (!isNaN(pins2) && !isNaN(pins3) && pins2 + pins3 === 10) return '/'
      }
    }
    return val
  }

  function setBall(fi, ballIdx, val) {
    const frame = frames[fi]
    const isTenth = frame.frame === 10
    let balls = [...frame.balls]

    val = applyAutoSpare(balls, ballIdx, val)

    if (!isTenth && ballIdx === 0) {
      if (val === 'X') balls = ['X']
      else if (frame.balls[0] === 'X') balls = [val, '-']
      else { balls[0] = val }
    } else {
      while (balls.length <= ballIdx) balls.push('-')
      balls[ballIdx] = val

      if (isTenth) {
        const needsFill = balls[0] === 'X' || balls[1] === '/'
        if (!needsFill && balls.length > 2) {
          if (balls[2]) cachedFillBallRef.current = balls[2]
          balls.splice(2)
        } else if (needsFill && balls.length <= 2 && cachedFillBallRef.current) {
          balls[2] = cachedFillBallRef.current
        }
      }
    }

    const b1 = balls[0]
    const splitStillValid = frame.split && b1 !== 'X' && b1 !== '9'
    const splitPickedUp = splitStillValid ? balls[1] === '/' : false
    onChange(frames.map((f, i) => i === fi ? { ...f, balls, split: splitStillValid, splitPickedUp } : f))
  }

  function toggleSplit(fi) {
    const frame = frames[fi]
    const b1 = frame.balls[0]
    if (!frame.split && (b1 === 'X' || b1 === '9')) return
    const split = !frame.split
    onChange(frames.map((f, i) => i === fi ? { ...f, split, splitPickedUp: split ? f.splitPickedUp : false } : f))
  }

  return (
    <div
      data-frame-grid
      className="overflow-x-auto rounded-lg"
      style={{ border: borderStyle, background: 'var(--elevated)' }}
    >
      <div className="flex min-w-max">
        {frames.map((frame, fi) => {
          const isTenth = frame.frame === 10
          const isStrike = !isTenth && frame.balls[0] === 'X'
          const needsFill = isTenth && (frame.balls[0] === 'X' || frame.balls[1] === '/')

          return (
            <div
              key={frame.frame}
              className={`flex flex-col text-center ${isTenth ? 'w-[5.5rem]' : 'w-[3.75rem]'}`}
              style={{ borderRight: borderStyle }}
            >
              {/* Frame number + split toggle */}
              <div className="flex items-center justify-center gap-1 py-0.5" style={{ borderBottom: borderStyle }}>
                <span className="text-[10px] font-medium" style={{ color: 'var(--sub)' }}>{frame.frame}</span>
                <button
                  title={frame.split ? 'Split (click to remove)' : 'Mark as split'}
                  onClick={() => toggleSplit(fi)}
                  className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold transition-colors"
                  style={frame.split ? {
                    border: '1px solid var(--loss)',
                    background: 'color-mix(in srgb, var(--loss) 15%, transparent)',
                    color: 'var(--loss)',
                  } : {
                    border: '1px solid var(--border)',
                    color: 'var(--border)',
                  }}
                >
                  S
                </button>
              </div>

              {/* Ball inputs */}
              <div className="flex py-1" style={{ borderBottom: borderStyle }}>
                {isTenth ? (
                  <>
                    <div className="flex-1 flex items-center justify-center"><EditableBallInput value={frame.balls[0] ?? ''} onChange={v => setBall(fi, 0, v)} /></div>
                    <div className="flex-1 flex items-center justify-center"><EditableBallInput value={frame.balls[1] ?? ''} onChange={v => setBall(fi, 1, v)} /></div>
                    <div className="flex-1 flex items-center justify-center"><EditableBallInput value={frame.balls[2] ?? ''} onChange={v => setBall(fi, 2, v)} disabled={!needsFill} /></div>
                  </>
                ) : isStrike ? (
                  <div className="flex-1 flex items-center justify-center"><EditableBallInput value="X" onChange={v => setBall(fi, 0, v)} /></div>
                ) : (
                  <>
                    <div className="flex-1 flex items-center justify-center"><EditableBallInput value={frame.balls[0] ?? ''} onChange={v => setBall(fi, 0, v)} /></div>
                    <div className="flex-1 flex items-center justify-center"><EditableBallInput value={frame.balls[1] ?? ''} onChange={v => setBall(fi, 1, v)} /></div>
                  </>
                )}
              </div>

              {/* Running score */}
              <div className="py-1.5 text-xs font-semibold" style={{ color: 'var(--text)' }}>
                {frame.runningScore ?? ''}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
