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
      rollIdx += 1
    } else if (frame.balls[1] === '/') {
      frameScore = 10 + (rolls[rollIdx + 2] ?? 0)
      rollIdx += 2
    } else {
      frameScore = pv(frame.balls[0]) + pv(frame.balls[1])
      rollIdx += frame.balls[1] != null ? 2 : 1
    }

    running += frameScore
    return { ...frame, runningScore: running }
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

  return { strikes, spares, opens, initialRun }
}
