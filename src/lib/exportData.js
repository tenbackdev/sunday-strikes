import { supabase } from './supabase'
import { computeScores } from './parseGame'

function toLocalDateTimeStr(isoStr) {
  const d = new Date(isoStr)
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} ${time}`
}

export async function fetchExportableGames(session) {
  const { data, error } = await supabase
    .from('games')
    .select('id, played_at, player_label, total_score, frames, ai_frames, is_vs, vs_match_id')
    .eq('user_id', session.user.id)
    .order('played_at')
  if (error) throw error

  return (data ?? []).map(game => ({
    ...game,
    // eslint-disable-next-line no-unused-vars
    frames: computeScores(game.frames).map(({ _complete, ...frame }) => frame),
  }))
}

export function buildGamesJSON(games) {
  const payload = games.map(game => ({
    id: game.id,
    played_at: game.played_at,
    played_at_local: toLocalDateTimeStr(game.played_at),
    player_label: game.player_label,
    total_score: game.total_score,
    is_vs: game.is_vs,
    vs_match_id: game.vs_match_id,
    frames_edited: !!game.ai_frames,
    frames: game.frames,
    ...(game.ai_frames ? { ai_frames: game.ai_frames } : {}),
  }))
  return JSON.stringify(payload, null, 2)
}

function csvField(value) {
  const str = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function buildFramesCSV(games) {
  const header = [
    'game_id', 'played_at_utc', 'played_at_local', 'player_label', 'total_score',
    'is_vs', 'vs_match_id', 'frames_edited', 'frame_number',
    'ball_1', 'ball_2', 'ball_3', 'split', 'running_score',
  ]
  const rows = [header.join(',')]

  for (const game of games) {
    const framesEdited = !!game.ai_frames
    const playedAtLocal = toLocalDateTimeStr(game.played_at)
    for (const frame of game.frames) {
      const [b1, b2, b3] = frame.balls ?? []
      rows.push([
        game.id,
        game.played_at,
        playedAtLocal,
        game.player_label,
        game.total_score,
        game.is_vs,
        game.vs_match_id,
        framesEdited,
        frame.frame,
        b1,
        b2,
        b3,
        !!frame.split,
        frame.runningScore,
      ].map(csvField).join(','))
    }
  }
  return rows.join('\n')
}

export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportFilename(ext) {
  const d = new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `sunday-strikes-games-${date}.${ext}`
}
