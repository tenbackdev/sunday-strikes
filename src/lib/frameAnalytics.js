import { computeStats, computeScores, countRacks, frameScoreParts } from './parseGame'
import { MIN_TREND_SAMPLE, toLocalDateStr } from './chartFormat'

// Pure derivations behind the desktop-only Stats / VS Stats cards.
// `games` arrays are rows from the `games` table (newest-first, as Stats loads them)
// unless a function says otherwise.

const pins = b => b === 'X' ? 10 : b === '-' ? 0 : parseInt(b, 10)
const avg = (sum, n) => n > 0 ? sum / n : 0
const pct = (num, den) => den > 0 ? Math.round((num / den) * 100) : null

export function chronological(games) {
  return [...games].sort((a, b) => new Date(a.played_at) - new Date(b.played_at))
}

// ── Rack-level walk ──────────────────────────────────────────────────────────

export const RACK_POSITIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10·R1', '10·R2', '10·R3']

// Every fresh rack faced in a game, in throw order. outcome:
//   'strike' | 'spare' | 'open' — normal two-ball racks
//   'nostrike'                  — a single-ball fill rack (10th R2 after a spare, 10th R3) that wasn't a strike;
//                                 a spare is impossible there, so it isn't an "open" in computeStats terms
// Strike/spare counts match computeStats; opens match computeStats when 'nostrike' is excluded.
export function rackOutcomes(frames) {
  const out = []
  for (const f of frames ?? []) {
    const [b1, b2, b3] = f.balls ?? []
    if (f.frame !== 10) {
      out.push({ pos: String(f.frame), frame: f.frame, outcome: b1 === 'X' ? 'strike' : b2 === '/' ? 'spare' : 'open', fill: false, firstPins: pins(b1) })
      continue
    }
    if (b1 === 'X') {
      out.push({ pos: '10·R1', frame: 10, outcome: 'strike', fill: false, firstPins: 10 })
      if (b2 === 'X') {
        out.push({ pos: '10·R2', frame: 10, outcome: 'strike', fill: false, firstPins: 10 })
        if (b3 != null) out.push({ pos: '10·R3', frame: 10, outcome: b3 === 'X' ? 'strike' : 'nostrike', fill: true, firstPins: pins(b3) })
      } else if (b2 != null) {
        out.push({ pos: '10·R2', frame: 10, outcome: b3 === '/' ? 'spare' : 'open', fill: false, firstPins: pins(b2) })
      }
    } else {
      out.push({ pos: '10·R1', frame: 10, outcome: b2 === '/' ? 'spare' : 'open', fill: false, firstPins: pins(b1) })
      if (b2 === '/' && b3 != null) out.push({ pos: '10·R2', frame: 10, outcome: b3 === 'X' ? 'strike' : 'nostrike', fill: true, firstPins: pins(b3) })
    }
  }
  return out
}

// First-ball pin counts for every fresh rack (frames 1–9 ball 1, plus each new 10th-frame rack).
export function firstBalls(frames) {
  return rackOutcomes(frames).map(r => r.firstPins).filter(p => !isNaN(p))
}

// 100% stacked Strike / Spare / Open mix per rack position.
export function frameOutcomeMix(games) {
  const acc = Object.fromEntries(RACK_POSITIONS.map(p => [p, { strike: 0, spare: 0, open: 0, nostrike: 0, fillRacks: 0 }]))
  for (const g of games) {
    for (const r of rackOutcomes(g.frames)) {
      acc[r.pos][r.outcome]++
      if (r.fill) acc[r.pos].fillRacks++
    }
  }
  return RACK_POSITIONS.map(pos => {
    const a = acc[pos]
    const racks = a.strike + a.spare + a.open + a.nostrike
    const share = n => racks > 0 ? Math.round((n / racks) * 1000) / 10 : 0
    return {
      label: pos,
      racks,
      counts: a,
      strikePct: share(a.strike),
      sparePct:  share(a.spare),
      openPct:   share(a.open),
      fillPct:   share(a.nostrike),
      lowSample: racks < MIN_TREND_SAMPLE,
    }
  })
}

// Strike % and spare conversion % per frame 1–10 (10th aggregates every rack it contains).
export function perFrameRates(games) {
  const acc = Array.from({ length: 10 }, () => ({ racks: 0, strikes: 0, spareAttempts: 0, spares: 0, firstPins: 0, firstCount: 0 }))
  for (const g of games) {
    for (const r of rackOutcomes(g.frames)) {
      const a = acc[r.frame - 1]
      if (!a) continue
      a.racks++
      if (r.outcome === 'strike') a.strikes++
      if (r.outcome === 'spare' || r.outcome === 'open') {
        a.spareAttempts++
        if (r.outcome === 'spare') a.spares++
      }
      if (!isNaN(r.firstPins)) { a.firstPins += r.firstPins; a.firstCount++ }
    }
  }
  return acc.map((a, i) => ({
    label: String(i + 1),
    ...a,
    strikePct: a.racks >= MIN_TREND_SAMPLE ? pct(a.strikes, a.racks) : null,
    convPct:   a.spareAttempts >= MIN_TREND_SAMPLE ? pct(a.spares, a.spareAttempts) : null,
    firstBallAvg: a.firstCount > 0 ? Math.round((a.firstPins / a.firstCount) * 10) / 10 : null,
  }))
}

// P(strike | previous rack in the same game was a strike) vs after a non-strike.
export function strikeCarry(games) {
  let afterX = 0, afterXHit = 0, afterNon = 0, afterNonHit = 0, turkeys = 0
  for (const g of games) {
    const seq = rackOutcomes(g.frames)
    let run = 0
    for (let i = 0; i < seq.length; i++) {
      const isX = seq[i].outcome === 'strike'
      if (i > 0) {
        if (seq[i - 1].outcome === 'strike') { afterX++; if (isX) afterXHit++ }
        else { afterNon++; if (isX) afterNonHit++ }
      }
      if (isX) { run++; if (run === 3) turkeys++ } else run = 0
    }
  }
  return { afterStrikePct: pct(afterXHit, afterX), afterNonStrikePct: pct(afterNonHit, afterNon), turkeys }
}

// ── Score-level summaries ────────────────────────────────────────────────────

export function scoreSummary(games) {
  const scores = games.map(g => g.total_score ?? 0)
  const n = scores.length
  const mean = avg(scores.reduce((s, v) => s + v, 0), n)
  const variance = avg(scores.reduce((s, v) => s + (v - mean) ** 2, 0), n)
  const sessions = new Set(games.map(g => toLocalDateStr(g.played_at))).size
  const clean = games.filter(g => computeStats(g.frames ?? []).opens === 0).length
  return {
    low: n ? Math.min(...scores) : 0,
    stdDev: Math.round(Math.sqrt(variance)),
    pct200: pct(scores.filter(s => s >= 200).length, n) ?? 0,
    cleanGames: clean,
    sessions,
  }
}

// Games grouped by local day, each day's games in throw order.
function sessionsByDay(games) {
  const map = {}
  for (const g of chronological(games)) {
    const day = toLocalDateStr(g.played_at)
    ;(map[day] ??= []).push(g)
  }
  return map
}

// Average score by position in the session (G1, G2, G3, G4+).
export function sessionOrderAvgs(games) {
  const buckets = [['G1', 0, 0], ['G2', 0, 0], ['G3', 0, 0], ['G4+', 0, 0]]
  for (const day of Object.values(sessionsByDay(games))) {
    day.forEach((g, i) => {
      const b = buckets[Math.min(i, 3)]
      b[1] += g.total_score ?? 0
      b[2]++
    })
  }
  return buckets.map(([label, sum, count]) => ({ label, count, avg: count > 0 ? Math.round(sum / count) : null }))
}

export function personalRecords(games) {
  const top = [...games].sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0)).slice(0, 5)
  let bestSession = null, bestSeries = null, mostStrikes = null
  for (const [date, day] of Object.entries(sessionsByDay(games))) {
    const scores = day.map(g => g.total_score ?? 0)
    const sAvg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
    if (day.length >= 2 && (!bestSession || sAvg > bestSession.value)) bestSession = { value: sAvg, date, games: day.length }
    for (let i = 0; i + 2 < scores.length; i++) {
      const sum = scores[i] + scores[i + 1] + scores[i + 2]
      if (!bestSeries || sum > bestSeries.value) bestSeries = { value: sum, date }
    }
  }
  for (const g of games) {
    const x = computeStats(g.frames ?? []).strikes
    if (!mostStrikes || x > mostStrikes.value) mostStrikes = { value: x, date: toLocalDateStr(g.played_at) }
  }
  return {
    top: top.map(g => ({ id: g.id, score: g.total_score ?? 0, date: toLocalDateStr(g.played_at) })),
    bestSession, bestSeries, mostStrikes,
  }
}

// Month-by-month table rows, newest first, with Δ avg vs. the previous month that had games.
export function monthlyBreakdown(games) {
  const map = {}
  for (const g of games) {
    const key = toLocalDateStr(g.played_at).slice(0, 7)
    const m = (map[key] ??= { key, scores: [], strikes: 0, racks: 0, spares: 0, opens: 0 })
    const st = computeStats(g.frames ?? [])
    m.scores.push(g.total_score ?? 0)
    m.strikes += st.strikes; m.racks += countRacks(g.frames ?? [])
    m.spares += st.spares; m.opens += st.opens
  }
  const rows = Object.values(map).sort((a, b) => a.key.localeCompare(b.key)).map(m => ({
    key: m.key,
    games: m.scores.length,
    avg: Math.round(m.scores.reduce((s, v) => s + v, 0) / m.scores.length),
    high: Math.max(...m.scores),
    low: Math.min(...m.scores),
    strikePct: pct(m.strikes, m.racks),
    sparePct: pct(m.spares, m.spares + m.opens),
  }))
  rows.forEach((r, i) => { r.delta = i > 0 ? r.avg - rows[i - 1].avg : null })
  return rows.reverse()
}

// { 'YYYY-MM-DD': { games, avg } } keyed by local date.
export function activityByDay(games) {
  const out = {}
  for (const [date, day] of Object.entries(sessionsByDay(games))) {
    out[date] = { games: day.length, avg: Math.round(day.reduce((s, g) => s + (g.total_score ?? 0), 0) / day.length) }
  }
  return out
}

// ── Rolling trends (chronological input) ─────────────────────────────────────

export function rollingStrikeAndFirstBall(games, N = 10) {
  const chrono = chronological(games)
  const per = chrono.map(g => {
    const fb = firstBalls(g.frames)
    return {
      strikes: computeStats(g.frames ?? []).strikes,
      racks: countRacks(g.frames ?? []),
      fbSum: fb.reduce((s, v) => s + v, 0),
      fbCount: fb.length,
    }
  })
  return per.map((_, i) => {
    let x = 0, r = 0, fs = 0, fc = 0
    for (let j = Math.max(0, i - N + 1); j <= i; j++) {
      x += per[j].strikes; r += per[j].racks; fs += per[j].fbSum; fc += per[j].fbCount
    }
    return {
      index: i + 1,
      strikePct: r >= MIN_TREND_SAMPLE ? pct(x, r) : null,
      firstBallAvg: fc >= MIN_TREND_SAMPLE ? Math.round((fs / fc) * 100) / 100 : null,
    }
  })
}

// ── Opens / composition / per-frame points ───────────────────────────────────

export function opensDistribution(games) {
  const counts = Array(11).fill(0)
  for (const g of games) counts[Math.min(computeStats(g.frames ?? []).opens, 10)]++
  const peak = Math.max(...counts)
  return counts.map((count, i) => ({ label: String(i), count, isMax: peak > 0 && count === peak }))
}

// Average per game of each score component (see frameScoreParts); sums to the average score.
export function scoreComposition(games) {
  const tot = { firstBall: 0, secondBall: 0, strikeBonus: 0, spareBonus: 0 }
  const perFrame = Array.from({ length: 10 }, () => ({ points: 0, n: 0 }))
  let bonusStrikes = 0, bonusSpares = 0
  for (const g of games) {
    for (const f of g.frames ?? []) {
      if (f.frame === 10) continue
      if (f.balls?.[0] === 'X') bonusStrikes++
      else if (f.balls?.[1] === '/') bonusSpares++
    }
    for (const p of frameScoreParts(g.frames ?? [])) {
      tot.firstBall += p.firstBall; tot.secondBall += p.secondBall
      tot.strikeBonus += p.strikeBonus; tot.spareBonus += p.spareBonus
      const slot = perFrame[p.frame - 1]
      if (slot) { slot.points += p.firstBall + p.secondBall + p.strikeBonus + p.spareBonus; slot.n++ }
    }
  }
  const n = games.length || 1
  const r1 = v => Math.round((v / n) * 10) / 10
  return {
    composition: { firstBall: r1(tot.firstBall), secondBall: r1(tot.secondBall), strikeBonus: r1(tot.strikeBonus), spareBonus: r1(tot.spareBonus) },
    // Frames 1–9 only — the 10th frame earns no bonus
    bonusPerStrike: bonusStrikes ? Math.round((tot.strikeBonus / bonusStrikes) * 10) / 10 : null,
    bonusPerSpare:  bonusSpares  ? Math.round((tot.spareBonus  / bonusSpares)  * 10) / 10 : null,
    pointsPerFrame: perFrame.map((f, i) => ({ label: String(i + 1), points: f.n ? Math.round((f.points / f.n) * 10) / 10 : 0 })),
  }
}

// ── Player summary (used for VS head-to-head) ────────────────────────────────

export function playerSummary(games) {
  const n = games.length
  const scores = games.map(g => g.total_score ?? 0)
  let strikes = 0, racks = 0, spares = 0, opens = 0, splits = 0, conv = 0, fbSum = 0, fbCount = 0
  for (const g of games) {
    const st = computeStats(g.frames ?? [])
    strikes += st.strikes; spares += st.spares; opens += st.opens; splits += st.splits; conv += st.conv
    racks += countRacks(g.frames ?? [])
    const fb = firstBalls(g.frames)
    fbSum += fb.reduce((s, v) => s + v, 0); fbCount += fb.length
  }
  return {
    games: n,
    avg: n ? Math.round(scores.reduce((s, v) => s + v, 0) / n) : 0,
    high: n ? Math.max(...scores) : 0,
    low: n ? Math.min(...scores) : 0,
    strikePct: pct(strikes, racks),
    sparePct: pct(spares, spares + opens),
    splitConvPct: pct(conv, splits),
    splits,
    strikesPerGame: n ? strikes / n : 0,
    sparesPerGame: n ? spares / n : 0,
    opensPerGame: n ? opens / n : 0,
    splitsPerGame: n ? splits / n : 0,
    firstBallAvg: fbCount ? fbSum / fbCount : 0,
    games200: scores.filter(s => s >= 200).length,
  }
}

// ── VS-only derivations (enriched matches from useVsMatches) ─────────────────

export function vsSummary(matches) {
  const chrono = [...matches].sort((a, b) => new Date(a.played_at) - new Date(b.played_at))
  let w = 0, l = 0, t = 0, diff = 0, winMargin = 0, lossMargin = 0
  let longestWin = 0, run = 0
  for (const m of chrono) {
    const d = (m.myGame?.total_score ?? 0) - (m.theirGame?.total_score ?? 0)
    diff += d
    if (m.result === 'W') { w++; winMargin += d; run++; longestWin = Math.max(longestWin, run) }
    else { run = 0; if (m.result === 'L') { l++; lossMargin += -d } else t++ }
  }
  // Current streak: count back from the latest match while the result repeats
  let current = null
  for (let i = chrono.length - 1; i >= 0; i--) {
    const r = chrono[i].result
    if (!current) current = { result: r, count: 1 }
    else if (r === current.result) current.count++
    else break
  }
  const total = chrono.length
  return {
    record: `${w}-${l}${t ? `-${t}` : ''}`,
    winPct: pct(w, total) ?? 0,
    avgDiff: total ? Math.round(diff / total) : 0,
    current,
    longestWin,
    avgWinMargin: w ? Math.round(winMargin / w) : null,
    avgLossMargin: l ? Math.round(lossMargin / l) : null,
  }
}

// Average running-score lead (mine − theirs) after each frame, plus how often a
// match was trailing after that frame and how many of those were still won.
export function frameLead(matches) {
  const acc = Array.from({ length: 10 }, () => ({ leadSum: 0, n: 0, trailing: 0, comebacks: 0, leading: 0, blown: 0 }))
  for (const m of matches) {
    const mine = computeScores(m.myGame?.frames ?? [])
    const theirs = computeScores(m.theirGame?.frames ?? [])
    for (let i = 0; i < 10; i++) {
      const a = mine[i]?.runningScore, b = theirs[i]?.runningScore
      if (a == null || b == null) continue
      const lead = a - b
      const s = acc[i]
      s.leadSum += lead; s.n++
      if (lead < 0) { s.trailing++; if (m.result === 'W') s.comebacks++ }
      if (lead > 0) { s.leading++; if (m.result === 'L') s.blown++ }
    }
  }
  return acc.map((s, i) => ({
    label: String(i + 1),
    lead: s.n ? Math.round((s.leadSum / s.n) * 10) / 10 : 0,
    n: s.n, trailing: s.trailing, comebacks: s.comebacks, leading: s.leading, blown: s.blown,
  }))
}

// My per-game numbers in wins vs. losses — what separates the two.
export function winLossProfile(matches) {
  const wins = matches.filter(m => m.result === 'W').map(m => m.myGame).filter(Boolean)
  const losses = matches.filter(m => m.result === 'L').map(m => m.myGame).filter(Boolean)
  const W = playerSummary(wins), L = playerSummary(losses)
  const r1 = v => Math.round(v * 10) / 10
  return {
    wins: wins.length,
    losses: losses.length,
    rows: [
      { label: 'Strikes',   win: r1(W.strikesPerGame), loss: r1(L.strikesPerGame) },
      { label: 'Spares',    win: r1(W.sparesPerGame),  loss: r1(L.sparesPerGame) },
      { label: 'Opens',     win: r1(W.opensPerGame),   loss: r1(L.opensPerGame) },
      { label: 'Splits',    win: r1(W.splitsPerGame),  loss: r1(L.splitsPerGame) },
      { label: '1st Ball',  win: r1(W.firstBallAvg),   loss: r1(L.firstBallAvg) },
    ],
  }
}

// Per-match series for a single opponent: scores + cumulative W−L.
export function opponentTimeline(matches) {
  const chrono = [...matches].sort((a, b) => new Date(a.played_at) - new Date(b.played_at))
  let net = 0
  return chrono.map((m, i) => {
    net += m.result === 'W' ? 1 : m.result === 'L' ? -1 : 0
    return { index: i + 1, date: toLocalDateStr(m.played_at), me: m.myGame?.total_score ?? 0, them: m.theirGame?.total_score ?? 0, net, result: m.result }
  })
}
