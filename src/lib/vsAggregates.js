import { computeStats } from './parseGame'

// Groups enriched vs_matches rows (see useVsMatches) by opponent, aggregating
// record and per-game stats. Sorted by total matches played, descending.
export function groupByOpponent(matches) {
  const byOpponent = {}
  matches.forEach(m => {
    const key = m.opponentProfile?.id
    if (!key) return
    if (!byOpponent[key]) byOpponent[key] = {
      profile: m.opponentProfile, w: 0, l: 0, t: 0,
      myPins: 0, oppPins: 0,
      myStrikes: 0, oppStrikes: 0,
      mySpares: 0, oppSpares: 0,
      myOpens: 0, oppOpens: 0,
      matches: [],
    }
    const b = byOpponent[key]
    if (m.result === 'W') b.w++; else if (m.result === 'L') b.l++; else b.t++
    b.myPins += m.myGame?.total_score ?? 0
    b.oppPins += m.theirGame?.total_score ?? 0
    if (m.myGame?.frames) {
      const s = computeStats(m.myGame.frames)
      b.myStrikes += s.strikes; b.mySpares += s.spares; b.myOpens += s.opens
    }
    if (m.theirGame?.frames) {
      const s = computeStats(m.theirGame.frames)
      b.oppStrikes += s.strikes; b.oppSpares += s.spares; b.oppOpens += s.opens
    }
    b.matches.push(m)
  })
  return Object.values(byOpponent).sort((a, b) => (b.w + b.l + b.t) - (a.w + a.l + a.t))
}
