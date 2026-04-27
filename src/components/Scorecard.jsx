import { useRef } from 'react'
import { isConvertedSplit } from '../lib/parseGame'

// ── Ball mark (display only) ─────────────────────────────────────────────────

export function BallMark({ value }) {
  if (value === 'X') return <span className="font-bold text-red-500">X</span>
  if (value === '/') return <span className="font-bold text-blue-500">/</span>
  if (value === '-') return <span className="text-gray-400">-</span>
  return <span className="text-gray-700">{value}</span>
}

// ── Editable ball input ──────────────────────────────────────────────────────

export function EditableBallInput({ value, onChange, disabled }) {
  const inputRef = useRef(null)
  const color =
    value === 'X' ? 'text-red-500 border-red-200 bg-red-50' :
    value === '/' ? 'text-blue-500 border-blue-200 bg-blue-50' :
    value === '-' ? 'text-gray-400 border-gray-100 bg-gray-50' :
    'text-gray-700 border-gray-200 bg-white'

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
        if (raw === '' || /^[X\/\-1-9]$/.test(raw)) {
          onChange(raw)
          if (/^[X\/\-1-9]$/.test(raw)) {
            const grid = inputRef.current?.closest('[data-frame-grid]')
            const all = Array.from(grid?.querySelectorAll('[data-ball-input]:not([disabled])') ?? [])
            const idx = all.indexOf(inputRef.current)
            if (idx >= 0 && idx < all.length - 1) all[idx + 1].focus()
          }
        }
      }}
      className={`w-7 h-7 rounded border text-center text-xs font-bold outline-none transition-colors
        ${color}
        ${disabled ? 'opacity-25 cursor-not-allowed' : 'focus:ring-1 focus:ring-slate-400'}`}
    />
  )
}

// ── Stat table ───────────────────────────────────────────────────────────────

export function StatTable({ strikes, spares, opens, initialRun, frames }) {
  const splits = frames?.filter(f => f?.split).length ?? 0
  const converted = frames?.filter(f => isConvertedSplit(f)).length ?? 0
  const cols = [
    { header: 'X',  headerClass: 'font-bold text-red-400',  value: strikes },
    { header: '/',  headerClass: 'font-bold text-blue-400', value: spares },
    { header: '-',  headerClass: 'font-medium text-gray-400', value: opens },
    { header: '#',  headerClass: 'font-medium text-gray-500', value: initialRun },
    { header: 'S',  headerClass: 'font-medium text-gray-500', value: splits },
    { header: 'S/', headerClass: 'font-medium text-gray-500', value: converted },
  ]
  return (
    <div className="grid grid-cols-6 gap-x-1 text-center">
      {cols.map(c => (
        <div key={c.header} className={`text-[10px] leading-tight ${c.headerClass}`}>{c.header}</div>
      ))}
      {cols.map(c => (
        <div key={`v-${c.header}`} className="text-sm font-semibold text-gray-800 leading-tight">{c.value}</div>
      ))}
    </div>
  )
}

// ── Scorecard frame grid (read-only) ─────────────────────────────────────────

export function FrameGrid({ frames }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex w-max rounded-lg border border-gray-100 mx-auto">
        {frames.map((frame) => {
          const isTenth = frame.frame === 10
          const hasSplit = !!frame.split
          // Frame 10: split circle goes on ball 2 when ball 1 is a strike, otherwise ball 1
          const splitBallIdx = isTenth && frame.balls[0] === 'X' ? 1 : 0
          // Wraps a ball mark with a red circle when it is the split ball
          const sb = (val, idx) => hasSplit && idx === splitBallIdx ? (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-red-400">
              <BallMark value={val} />
            </span>
          ) : <BallMark value={val} />

          return (
            <div
              key={frame.frame}
              className={`flex flex-col border-r border-gray-100 last:border-r-0 text-center ${isTenth ? 'w-[4.5rem]' : 'w-10'}`}
            >
              <div className="flex items-center justify-center border-b border-gray-100 py-0.5">
                <span className="text-[10px] font-medium text-gray-400">{frame.frame}</span>
              </div>
              <div className="flex h-7 border-b border-gray-100 text-xs">
                {isTenth ? (
                  <>
                    <div className="flex-1 flex items-center justify-center border-r border-gray-50">{sb(frame.balls[0] ?? '', 0)}</div>
                    <div className="flex-1 flex items-center justify-center border-r border-gray-50">{frame.balls[1] != null && sb(frame.balls[1], 1)}</div>
                    <div className="flex-1 flex items-center justify-center">
                      {(frame.balls[0] === 'X' || frame.balls[1] === '/') && frame.balls[2] != null && <BallMark value={frame.balls[2]} />}
                    </div>
                  </>
                ) : frame.balls[0] === 'X' ? (
                  <div className="flex-1 flex items-center justify-center"><BallMark value="X" /></div>
                ) : (
                  <>
                    <div className="flex-1 flex items-center justify-center border-r border-gray-50">{sb(frame.balls[0] ?? '', 0)}</div>
                    <div className="flex-1 flex items-center justify-center">{frame.balls[1] != null && <BallMark value={frame.balls[1]} />}</div>
                  </>
                )}
              </div>
              <div className="py-1.5 text-xs font-semibold text-gray-800">{frame.runningScore}</div>
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
    <div data-frame-grid className="overflow-x-auto rounded-lg border border-gray-100">
      <div className="flex min-w-max">
        {frames.map((frame, fi) => {
          const isTenth = frame.frame === 10
          const isStrike = !isTenth && frame.balls[0] === 'X'
          const needsFill = isTenth && (frame.balls[0] === 'X' || frame.balls[1] === '/')

          return (
            <div
              key={frame.frame}
              className={`flex flex-col border-r border-gray-100 last:border-r-0 text-center ${isTenth ? 'w-[5.5rem]' : 'w-[3.75rem]'}`}
            >
              <div className="flex items-center justify-center gap-1 border-b border-gray-100 py-0.5">
                <span className="text-[10px] font-medium text-gray-400">{frame.frame}</span>
                <button
                  title={frame.split ? 'Split (click to remove)' : 'Mark as split'}
                  onClick={() => toggleSplit(fi)}
                  className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[8px] font-bold transition-colors
                    ${frame.split
                      ? 'border-red-400 bg-red-100 text-red-500'
                      : 'border-gray-200 text-gray-300 hover:border-red-300'}`}
                >
                  S
                </button>
              </div>

              <div className="flex border-b border-gray-100 py-1">
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

              <div className="py-1.5 text-xs font-semibold text-gray-800">
                {frame.runningScore ?? ''}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
