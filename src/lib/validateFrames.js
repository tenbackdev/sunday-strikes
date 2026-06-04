import { normalizeFrames } from './parseGame'

const VALID_BALL = /^[X/\-1-9]$/

function pv(ball, prevPins = 0) {
  if (!ball || ball === '-') return 0
  if (ball === 'X') return 10
  if (ball === '/') return Math.max(0, 10 - prevPins)
  return parseInt(ball, 10) || 0
}

/**
 * Validates and auto-corrects AI-parsed bowling frames before scoring.
 * Returns { frames, warnings } where warnings is a human-readable list
 * of every correction made. Empty warnings array means the parse was clean.
 */
export function sanitizeFrames(rawFrames) {
  if (!Array.isArray(rawFrames) || rawFrames.length === 0) {
    return {
      frames: Array.from({ length: 10 }, (_, i) => ({
        frame: i + 1, balls: ['-', '-'], split: false, splitPickedUp: false,
      })),
      warnings: ['AI response contained no frame data — all frames reset to gutter balls.'],
    }
  }

  const warnings = []
  let frames = rawFrames.map(f => ({
    ...f,
    balls: Array.isArray(f.balls) ? [...f.balls] : [],
  }))

  // 1. Frame count
  if (frames.length < 10) {
    warnings.push(`Only ${frames.length} frame(s) detected — missing frames padded with gutter balls.`)
    while (frames.length < 10) {
      const n = frames.length + 1
      frames.push({ frame: n, balls: ['-', '-'], split: false, splitPickedUp: false })
    }
  } else if (frames.length > 10) {
    warnings.push(`${frames.length} frames detected — trimmed to 10.`)
    frames = frames.slice(0, 10)
  }

  // Ensure frame numbers align with position
  frames = frames.map((f, i) => ({ ...f, frame: i + 1 }))

  frames = frames.map(frame => {
    const isLast = frame.frame === 10
    let balls = frame.balls.map(b =>
      b === null || b === undefined || b === '' ? '-' : String(b)
    )

    // 2. Replace unknown ball notation
    balls = balls.map((b, bi) => {
      if (!VALID_BALL.test(b)) {
        warnings.push(`Frame ${frame.frame}, ball ${bi + 1}: unrecognized value "${b}" replaced with "-".`)
        return '-'
      }
      return b
    })

    // 7. Ball 1 can never be a spare
    if (balls[0] === '/') {
      warnings.push(`Frame ${frame.frame}: ball 1 cannot be a spare — replaced with "-".`)
      balls[0] = '-'
    }

    if (!isLast) {
      // 3. Strike frames 1–9 must have exactly one ball
      if (balls[0] === 'X' && balls.length > 1) {
        warnings.push(`Frame ${frame.frame}: strike frame had extra balls — trimmed.`)
        balls = ['X']
      }

      // 4 & 5. Non-strike pin sum validation and auto-spare
      if (balls[0] !== 'X' && balls[1] != null && balls[1] !== '/') {
        const p1 = pv(balls[0])
        const p2 = pv(balls[1])
        if (p1 + p2 > 10) {
          warnings.push(`Frame ${frame.frame}: balls total ${p1 + p2} pins (impossible) — ball 2 reset to "-".`)
          balls[1] = '-'
        } else if (p1 + p2 === 10) {
          balls[1] = '/'
        }
      }
    } else {
      // Frame 10 specific checks
      const b1 = balls[0], b2 = balls[1], b3 = balls[2]

      if (b3 != null) {
        // Impossible: spare after double strike (fresh rack)
        if (b1 === 'X' && b2 === 'X' && b3 === '/') {
          warnings.push('Frame 10: ball 3 cannot be "/" after two strikes (fresh rack) — replaced with "-".')
          balls[2] = '-'
        }
        // Impossible: spare after spare on ball 2 (fresh rack)
        if (b2 === '/' && b3 === '/') {
          warnings.push('Frame 10: ball 3 cannot be "/" after a spare on ball 2 (fresh rack) — replaced with "-".')
          balls[2] = '-'
        }
      }

      // Strip ball 3 if no bonus ball was earned (open 10th frame)
      if (b1 !== 'X' && b2 !== '/' && balls.length > 2) {
        warnings.push('Frame 10: open frame should have 2 balls — extra ball removed.')
        balls = balls.slice(0, 2)
      }
    }

    return { ...frame, balls }
  })

  return { frames: normalizeFrames(frames), warnings }
}
