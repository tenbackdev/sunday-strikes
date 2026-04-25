export function computeStats(frames) {
  let strikes = 0
  let spares = 0
  let opens = 0
  let initialRun = 0
  let perfectStillPossible = true

  for (const frame of frames) {
    const [b1, b2] = frame.balls
    const isStrike = b1 === 'X'
    const isSpare = !isStrike && b2 === '/'
    const isOpen = !isStrike && !isSpare

    if (isStrike) strikes++
    else if (isSpare) spares++
    else opens++

    if (perfectStillPossible) {
      if (isStrike) initialRun++
      else perfectStillPossible = false
    }
  }

  return { strikes, spares, opens, initialRun }
}
