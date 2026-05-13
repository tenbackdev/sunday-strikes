import { useRef, useState } from 'react'
import { isConvertedSplit } from '../lib/parseGame'

// ── Ball mark (display only) ─────────────────────────────────────────────────

export function BallMark({ value }) {
  if (value === 'X') return <span className="font-bold" style={{ color: 'var(--strike)' }}>X</span>
  if (value === '/') return <span className="font-bold" style={{ color: 'var(--spare)' }}>/</span>
  if (value === '-') return <span style={{ color: 'var(--sub)' }}>-</span>
  return <span style={{ color: 'var(--text)' }}>{value}</span>
}

// ── Editable ball input ──────────────────────────────────────────────────────

export function EditableBallInput({ value, onChange, disabled, onFocus, onBlur, ...rest }) {
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
      inputMode="none"
      value={value ?? ''}
      disabled={disabled}
      data-ball-input
      {...rest}
      onFocus={e => {
        e.target.select()
        onFocus?.()
      }}
      onBlur={() => onBlur?.()}
      onChange={e => {
        let raw = e.target.value.toUpperCase()
        if (raw === '0') raw = '-'
        else if (raw === '10') raw = 'X'
        else raw = raw.slice(-1)
        if (raw === '' || /^[X/\-1-9]$/.test(raw)) {
          onChange(raw)
          if (/^[X/\-1-9]$/.test(raw)) {
            requestAnimationFrame(() => {
              const grid = inputRef.current?.closest('[data-frame-grid]')
              const all = Array.from(grid?.querySelectorAll('[data-ball-input]:not([disabled])') ?? [])
              const idx = all.indexOf(inputRef.current)
              if (idx >= 0 && idx < all.length - 1) all[idx + 1].focus()
            })
          }
        }
      }}
      className="rounded border text-center font-bold outline-none transition-colors w-full"
      style={{
        height: '26px',
        fontSize: '13px',
        minWidth: 0,
        ...inputStyle,
        opacity: disabled ? 0.25 : 1,
        cursor: disabled ? 'not-allowed' : 'text',
      }}
    />
  )
}

// ── Split ring overlay (editable grid) ───────────────────────────────────────

function SplitRing() {
  return (
    <span
      className="pointer-events-none absolute rounded"
      style={{ inset: '1px', border: '1.5px solid var(--loss)', opacity: 0.75 }}
    />
  )
}

// ── Bowling keypad ───────────────────────────────────────────────────────────

function BowlingKeypad({ visible, isSplit, isSplitEligible, onKey, onBackspace, onToggleSplit, onDone }) {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  const btn = 'flex items-center justify-center rounded-lg font-semibold select-none active:scale-[0.91] transition-transform'

  return (
    <div
      className="overflow-hidden"
      style={{
        maxHeight: visible ? '108px' : '0',
        marginTop: visible ? '8px' : '0',
        opacity: visible ? 1 : 0,
        transition: 'max-height 210ms ease, opacity 160ms ease, margin-top 180ms ease',
      }}
    >
      <div className="space-y-1.5">
        {/* Digit row */}
        <div className="grid grid-cols-10 gap-1">
          {digits.map(d => (
            <button
              key={d}
              onMouseDown={e => { e.preventDefault(); onKey(d) }}
              className={`${btn} h-10 text-sm`}
              style={{ background: 'var(--elevated)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              {d}
            </button>
          ))}
          <button
            onMouseDown={e => { e.preventDefault(); onBackspace() }}
            className={`${btn} h-10 text-base`}
            style={{ background: 'var(--elevated)', color: 'var(--sub)', border: '1px solid var(--border)' }}
          >
            ⌫
          </button>
        </div>

        {/* Special keys row */}
        <div className="grid grid-cols-5 gap-1">
          <button
            onMouseDown={e => { e.preventDefault(); onKey('X') }}
            className={`${btn} h-11 text-base`}
            style={{ background: 'color-mix(in srgb, var(--strike) 12%, var(--elevated))', color: 'var(--strike)', border: '1px solid color-mix(in srgb, var(--strike) 25%, transparent)' }}
          >
            X
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); onKey('/') }}
            className={`${btn} h-11 text-base`}
            style={{ background: 'color-mix(in srgb, var(--spare) 12%, var(--elevated))', color: 'var(--spare)', border: '1px solid color-mix(in srgb, var(--spare) 25%, transparent)' }}
          >
            /
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); onKey('-') }}
            className={`${btn} h-11 text-base`}
            style={{ background: 'var(--elevated)', color: 'var(--sub)', border: '1px solid var(--border)' }}
          >
            −
          </button>
          {isSplitEligible ? (
            <button
              onMouseDown={e => { e.preventDefault(); onToggleSplit() }}
              className={`${btn} h-11 text-xs`}
              style={isSplit ? {
                background: 'color-mix(in srgb, var(--loss) 15%, var(--elevated))',
                color: 'var(--loss)',
                border: '1.5px solid color-mix(in srgb, var(--loss) 40%, transparent)',
              } : {
                background: 'var(--elevated)',
                color: 'var(--sub)',
                border: '1px solid var(--border)',
              }}
            >
              Split
            </button>
          ) : <div />}
          <button
            onMouseDown={e => { e.preventDefault(); onDone() }}
            className={`${btn} h-11 text-sm`}
            style={{ background: 'var(--accent)', color: 'var(--acc-text)' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
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
    <div className="w-full">
      <div
        className="flex w-full rounded-lg"
        style={{ border: borderStyle }}
      >
        {frames.map((frame, i) => {
          const isTenth = frame.frame === 10
          const hasSplit = !!frame.split
          const splitBallIdx = isTenth && frame.balls[0] === 'X' ? 1 : 0
          const sb = (val, idx) => hasSplit && idx === splitBallIdx ? (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full"
              style={{ border: '1px solid var(--loss)' }}>
              <BallMark value={val} />
            </span>
          ) : <BallMark value={val} />

          return (
            <div
              key={frame.frame}
              className={`flex flex-col text-center ${isTenth ? 'flex-[1.5]' : 'flex-1'}`}
              style={{ borderRight: i < frames.length - 1 ? borderStyle : undefined }}
            >
              <div className="flex items-center justify-center py-0.5" style={{ borderBottom: borderStyle }}>
                <span className="text-[9px] font-medium" style={{ color: 'var(--sub)' }}>{frame.frame}</span>
              </div>
              <div className="flex h-6 text-xs" style={{ borderBottom: borderStyle }}>
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
              <div className="py-1 text-xs font-semibold" style={{ color: 'var(--text)' }}>{frame.runningScore}</div>
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
  const [focusedBall, setFocusedBall] = useState(null)
  const blurTimerRef = useRef(null)
  const containerRef = useRef(null)
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

    // Recompute split validity — handles 10th frame where split may be on ball[1]
    let splitStillValid = false
    let splitPickedUp = false
    if (frame.split) {
      if (isTenth && balls[0] === 'X') {
        const b2 = balls[1]
        splitStillValid = !!b2 && b2 !== 'X' && b2 !== '9'
        splitPickedUp = splitStillValid && balls[2] === '/'
      } else {
        const b1 = balls[0]
        splitStillValid = b1 !== 'X' && b1 !== '9'
        splitPickedUp = splitStillValid && balls[1] === '/'
      }
    }

    onChange(frames.map((f, i) => i === fi ? { ...f, balls, split: splitStillValid, splitPickedUp } : f))
  }

  function toggleSplit(fi) {
    const frame = frames[fi]
    const isTenth = frame.frame === 10

    if (isTenth && frame.balls[0] === 'X') {
      // 10th frame after strike: split applies to ball[1]
      const b2 = frame.balls[1]
      if (!frame.split && (!b2 || b2 === 'X' || b2 === '9')) return
      const split = !frame.split
      const splitPickedUp = split && frame.balls[2] === '/'
      onChange(frames.map((f, i) => i === fi ? { ...f, split, splitPickedUp } : f))
    } else {
      const b1 = frame.balls[0]
      if (!frame.split && (b1 === 'X' || b1 === '9')) return
      const split = !frame.split
      onChange(frames.map((f, i) => i === fi ? { ...f, split, splitPickedUp: split ? f.splitPickedUp : false } : f))
    }
  }

  function handleBallFocus(fi, ballIdx) {
    clearTimeout(blurTimerRef.current)
    setFocusedBall({ fi, ballIdx })
  }

  function handleBallBlur() {
    blurTimerRef.current = setTimeout(() => setFocusedBall(null), 150)
  }

  function handleKeypadKey(key) {
    if (!focusedBall) return
    const { fi, ballIdx } = focusedBall
    setBall(fi, ballIdx, key)
    requestAnimationFrame(() => {
      if (!containerRef.current) return
      const inputs = Array.from(containerRef.current.querySelectorAll('[data-ball-input]:not([disabled])'))
      const currentEl = containerRef.current.querySelector(`[data-ball-fi="${fi}"][data-ball-bidx="${ballIdx}"]:not([disabled])`)
      const currentIdx = currentEl ? inputs.indexOf(currentEl) : -1
      if (currentIdx >= 0 && currentIdx < inputs.length - 1) {
        inputs[currentIdx + 1].focus()
      }
    })
  }

  function handleKeypadBackspace() {
    if (!focusedBall) return
    setBall(focusedBall.fi, focusedBall.ballIdx, '')
  }

  function handleKeypadDone() {
    clearTimeout(blurTimerRef.current)
    document.activeElement?.blur()
    setFocusedBall(null)
  }

  function focusFrame(fi) {
    requestAnimationFrame(() => {
      const firstInput = containerRef.current?.querySelector(`[data-ball-fi="${fi}"][data-ball-bidx="0"]:not([disabled])`)
      firstInput?.focus()
    })
  }

  // Split eligibility for keypad button: mirrors toggleSplit rules
  function isSplitEligible() {
    if (!focusedBall) return false
    const { fi, ballIdx } = focusedBall
    const frame = frames[fi]
    const isTenth = frame.frame === 10

    // Fill ball (ball[2] in 10th) is never a split
    if (isTenth && ballIdx === 2) return false

    if (isTenth && frame.balls[0] === 'X') {
      // Split applies to ball[1] in this case
      if (ballIdx !== 1) return false
      if (frame.split) return true  // allow unmark
      const b2 = frame.balls[1]
      return !!b2 && b2 !== 'X' && b2 !== '9'
    }

    // All other frames: split applies to ball[0]
    if (ballIdx !== 0) return false
    if (frame.split) return true  // allow unmark
    const b1 = frame.balls[0]
    return !!b1 && b1 !== 'X' && b1 !== '9'
  }

  const isSplit = focusedBall ? (frames[focusedBall.fi]?.split ?? false) : false
  const splitEligible = isSplitEligible()

  return (
    <div ref={containerRef}>
      <div
        data-frame-grid
        className="rounded-lg overflow-hidden"
        style={{ border: borderStyle, background: 'var(--elevated)' }}
      >
        <div className="flex w-full">
          {frames.map((frame, fi) => {
            const isTenth = frame.frame === 10
            const isStrike = !isTenth && frame.balls[0] === 'X'
            const needsFill = isTenth && (frame.balls[0] === 'X' || frame.balls[1] === '/')
            const isFocused = focusedBall?.fi === fi
            const splitBallIdx = isTenth && frame.balls[0] === 'X' ? 1 : 0

            return (
              <div
                key={frame.frame}
                className={`flex flex-col text-center ${isTenth ? 'flex-[1.6]' : 'flex-1'}`}
                style={{
                  borderRight: fi < frames.length - 1 ? borderStyle : undefined,
                  background: isFocused ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : undefined,
                  transition: 'background 150ms ease',
                  cursor: 'pointer',
                }}
                onClick={() => focusFrame(fi)}
              >
                {/* Frame number */}
                <div className="flex items-center justify-center py-0.5" style={{ borderBottom: borderStyle }}>
                  <span className="text-[9px] font-medium" style={{ color: 'var(--sub)' }}>{frame.frame}</span>
                </div>

                {/* Ball inputs */}
                <div className="flex py-0.5" style={{ borderBottom: borderStyle }}>
                  {isTenth ? (
                    <>
                      <div className="flex-1 flex items-center justify-center relative" style={{ borderRight: borderStyle }}>
                        <EditableBallInput
                          value={frame.balls[0] ?? ''}
                          onChange={v => setBall(fi, 0, v)}
                          onFocus={() => handleBallFocus(fi, 0)}
                          onBlur={handleBallBlur}
                          data-ball-fi={fi}
                          data-ball-bidx={0}
                        />
                        {frame.split && splitBallIdx === 0 && <SplitRing />}
                      </div>
                      <div className="flex-1 flex items-center justify-center relative" style={{ borderRight: borderStyle }}>
                        <EditableBallInput
                          value={frame.balls[1] ?? ''}
                          onChange={v => setBall(fi, 1, v)}
                          onFocus={() => handleBallFocus(fi, 1)}
                          onBlur={handleBallBlur}
                          data-ball-fi={fi}
                          data-ball-bidx={1}
                        />
                        {frame.split && splitBallIdx === 1 && <SplitRing />}
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                        <EditableBallInput
                          value={frame.balls[2] ?? ''}
                          onChange={v => setBall(fi, 2, v)}
                          disabled={!needsFill}
                          onFocus={() => handleBallFocus(fi, 2)}
                          onBlur={handleBallBlur}
                          data-ball-fi={fi}
                          data-ball-bidx={2}
                        />
                      </div>
                    </>
                  ) : isStrike ? (
                    <div className="flex-1 flex items-center justify-center">
                      <EditableBallInput
                        value="X"
                        onChange={v => setBall(fi, 0, v)}
                        onFocus={() => handleBallFocus(fi, 0)}
                        onBlur={handleBallBlur}
                        data-ball-fi={fi}
                        data-ball-bidx={0}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 flex items-center justify-center relative" style={{ borderRight: borderStyle }}>
                        <EditableBallInput
                          value={frame.balls[0] ?? ''}
                          onChange={v => setBall(fi, 0, v)}
                          onFocus={() => handleBallFocus(fi, 0)}
                          onBlur={handleBallBlur}
                          data-ball-fi={fi}
                          data-ball-bidx={0}
                        />
                        {frame.split && <SplitRing />}
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                        <EditableBallInput
                          value={frame.balls[1] ?? ''}
                          onChange={v => setBall(fi, 1, v)}
                          onFocus={() => handleBallFocus(fi, 1)}
                          onBlur={handleBallBlur}
                          data-ball-fi={fi}
                          data-ball-bidx={1}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Running score */}
                <div className="py-1 text-[11px] font-semibold" style={{ color: 'var(--text)' }}>
                  {frame.runningScore ?? ''}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <BowlingKeypad
        visible={focusedBall !== null}
        isSplit={isSplit}
        isSplitEligible={splitEligible}
        onKey={handleKeypadKey}
        onBackspace={handleKeypadBackspace}
        onToggleSplit={() => focusedBall && toggleSplit(focusedBall.fi)}
        onDone={handleKeypadDone}
      />
    </div>
  )
}
