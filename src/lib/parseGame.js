function pv(ball, prevPins = 0) {
  if (!ball) return 0
  if (ball === 'X') return 10
  if (ball === '/') return Math.max(0, 10 - prevPins)
  if (ball === '-') return 0
  return parseInt(ball, 10) || 0
}

function buildRolls(frames) {
  const rolls = []
  for (const frame of frames) {
    if (frame.frame === 10) {
      const [b1, b2, b3] = frame.balls
      const r1 = pv(b1)
      let r2 = 0, r3 = 0
      if (r1 === 10) {
        r2 = pv(b2)
        if (b3) r3 = b2 === 'X' ? pv(b3) : pv(b3, r2)
      } else {
        r2 = b2 === '/' ? 10 - r1 : pv(b2)
        if (b3) r3 = pv(b3)
      }
      rolls.push(r1)
      if (b2 != null) rolls.push(r2)
      if (b3 != null) rolls.push(r3)
    } else {
      const r1 = pv(frame.balls[0])
      if (frame.balls[0] === 'X') {
        rolls.push(10)
      } else {
        rolls.push(r1)
        if (frame.balls[1] != null) rolls.push(frame.balls[1] === '/' ? 10 - r1 : pv(frame.balls[1]))
      }
    }
  }
  return rolls
}

export function computeScores(frames) {
  if (!frames?.length) return frames ?? []
  const rolls = buildRolls(frames)
  let rollIdx = 0
  let running = 0

  return frames.map(frame => {
    let frameScore = 0
    let _complete = true

    if (frame.frame === 10) {
      const [b1, b2, b3] = frame.balls
      const r1 = pv(b1)
      let r2 = 0, r3 = 0
      if (r1 === 10) {
        r2 = pv(b2)
        if (b3) r3 = b2 === 'X' ? pv(b3) : pv(b3, r2)
      } else {
        r2 = b2 === '/' ? 10 - r1 : pv(b2)
        if (b3) r3 = pv(b3)
      }
      frameScore = r1 + r2 + r3
    } else if (frame.balls[0] === 'X') {
      frameScore = 10 + (rolls[rollIdx + 1] ?? 0) + (rolls[rollIdx + 2] ?? 0)
      _complete = rolls.length > rollIdx + 2
      rollIdx += 1
    } else if (frame.balls[1] === '/') {
      frameScore = 10 + (rolls[rollIdx + 2] ?? 0)
      _complete = rolls.length > rollIdx + 2
      rollIdx += 2
    } else {
      frameScore = pv(frame.balls[0]) + pv(frame.balls[1])
      _complete = frame.balls[1] != null && frame.balls[1] !== ''
      rollIdx += frame.balls[1] != null ? 2 : 1
    }

    running += frameScore
    return { ...frame, runningScore: running, _complete }
  })
}

export function computeStats(frames) {
  let strikes = 0
  let spares = 0
  let opens = 0
  let initialRun = 0
  let perfectStillPossible = true

  for (const frame of frames) {
    if (frame.frame === 10) {
      const [b1, b2, b3] = frame.balls

      if (b1 === 'X') {
        // Scenarios 4, 5, 6, 7 — ball 1 is a strike
        strikes++
        if (perfectStillPossible) initialRun++

        if (b2 === 'X') {
          // Scenarios 6, 7 — ball 2 is also a strike
          strikes++
          if (perfectStillPossible) initialRun++
          if (b3 === 'X') {
            // Scenario 7 — all three strikes
            strikes++
            if (perfectStillPossible) initialRun++
          }
          // else: fill ball is a number — not counted (Scenario 6)
        } else {
          // Ball 2 is a number; balls 2+3 form either a spare or open
          perfectStillPossible = false
          if (b3 === '/') spares++ // Scenario 5
          else            opens++  // Scenario 4
        }
      } else {
        // Ball 1 is a number
        perfectStillPossible = false
        if (b2 === '/') {
          // Scenarios 2, 3 — balls 1+2 make a spare
          spares++
          if (b3 === 'X') strikes++ // Scenario 3 — fill strike
          // else: fill ball is a number — not counted (Scenario 2)
        } else {
          opens++ // Scenario 1 — open frame
        }
      }
    } else {
      // Frames 1–9
      const [b1, b2] = frame.balls
      const isStrike = b1 === 'X'
      const isSpare  = !isStrike && b2 === '/'

      if (isStrike)      strikes++
      else if (isSpare)  spares++
      else               opens++

      if (perfectStillPossible) {
        if (isStrike) initialRun++
        else          perfectStillPossible = false
      }
    }
  }

  let splits = 0, conv = 0
  for (const frame of frames) {
    if (frame.split) {
      splits++
      if (isConvertedSplit(frame)) conv++
    }
  }

  return { strikes, spares, opens, initialRun, run: initialRun, splits, conv }
}

export function isConvertedSplit(frame) {
  if (!frame?.split) return false
  const [b1, b2, b3] = frame.balls ?? []
  if (frame.frame === 10) return b1 === 'X' ? b3 === '/' : b2 === '/'
  return b2 === '/'
}

// Per-game leave analysis: classifies each non-strike frame by pins left after first ball,
// tracks spare conversion, and estimates missed score opportunity (pins left + bonus ball).
// careerAvgFB: caller-supplied career first-ball average used to estimate the unthrown fill
// ball when frame 10's first rack is open (the fill ball is never thrown in that case).
export function computeLeaveMetrics(frames, careerAvgFB = 7) {
  let singleAttempts = 0, singleConv = 0
  let multiAttempts = 0, multiConv = 0
  // Buckets 1–9, where key 9 = "9 or more pins left" (includes gutter-ball leaves)
  const leaveCounts = {}
  for (let i = 1; i <= 9; i++) leaveCounts[i] = { count: 0, converted: 0 }
  let missedPins = 0
  let hasEstimate = false

  for (let fi = 0; fi < frames.length; fi++) {
    const frame = frames[fi]
    if (!frame?.balls?.length) continue
    const [b1, b2] = frame.balls
    const isTenth = frame.frame === 10

    if (b1 === 'X') continue   // strike — no spare attempt this rack
    if (!b2) continue          // incomplete frame

    const firstCount = b1 === '-' ? 0 : (parseInt(b1, 10) || 0)
    const pinsLeft = 10 - firstCount
    const bucketKey = Math.min(pinsLeft, 9)
    if (bucketKey < 1) continue

    const isConverted = b2 === '/'
    leaveCounts[bucketKey].count++
    if (isConverted) leaveCounts[bucketKey].converted++

    if (bucketKey === 1) { singleAttempts++; if (isConverted) singleConv++ }
    else                 { multiAttempts++;  if (isConverted) multiConv++  }

    if (!isConverted) {
      const secondCount = b2 === '-' ? 0 : (parseInt(b2, 10) || 0)
      const pinsAfterSecond = Math.max(0, pinsLeft - secondCount)
      if (!isTenth) {
        const nb = frames[fi + 1]?.balls?.[0]
        const nextBall0 = nb === 'X' ? 10 : nb === '-' ? 0 : (parseInt(nb, 10) || 0)
        missedPins += pinsAfterSecond + nextBall0
      } else {
        // Fill ball never thrown — use career average as proxy
        missedPins += pinsAfterSecond + careerAvgFB
        hasEstimate = true
      }
    }
  }

  return { singleAttempts, singleConv, multiAttempts, multiConv, leaveCounts, missedPins, hasEstimate }
}

export function normalizeFrames(frames) {
  if (!frames?.length) return frames ?? []
  return frames.map(frame => {
    const isTenth = frame.frame === 10
    let balls = Array.isArray(frame.balls) ? [...frame.balls] : []
    balls = balls.map(b => (b === null || b === undefined || b === '') ? '-' : b)
    if (!isTenth) {
      if (balls[0] !== 'X' && balls.length < 2) balls.push('-')
    } else {
      while (balls.length < 2) balls.push('-')
      if ((balls[0] === 'X' || balls[1] === '/') && balls.length < 3) balls.push('-')
    }
    if (balls.length === 0) balls = ['-', '-']
    return { ...frame, balls }
  })
}
