import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// Loads every vs_matches row involving the session user, joins profiles + games,
// and enriches each match with myGame/theirGame/opponentProfile/result.
export function useVsMatches(session) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const userId = session.user.id
    const { data: matchRows } = await supabase
      .from('vs_matches')
      .select('id, submitter_id, opponent_id, submitter_game_id, opponent_game_id, played_at')
      .or(`submitter_id.eq.${userId},opponent_id.eq.${userId}`)
      .order('played_at', { ascending: false })

    if (!matchRows || matchRows.length === 0) { setMatches([]); setLoading(false); return }

    const allUserIds = [...new Set(matchRows.flatMap(m => [m.submitter_id, m.opponent_id]))]
    const allGameIds = matchRows.flatMap(m => [m.submitter_game_id, m.opponent_game_id])

    const [profilesRes, gamesRes] = await Promise.all([
      supabase.from('profiles').select('id, display_name, email, avatar_color').in('id', allUserIds),
      supabase.from('games').select('id, user_id, total_score, frames').in('id', allGameIds),
    ])

    const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]))
    const gameMap = Object.fromEntries((gamesRes.data || []).map(g => [g.id, g]))

    const enriched = matchRows.map(m => {
      const iAmSubmitter = m.submitter_id === userId
      const myGame = gameMap[iAmSubmitter ? m.submitter_game_id : m.opponent_game_id]
      const theirGame = gameMap[iAmSubmitter ? m.opponent_game_id : m.submitter_game_id]
      const opponentId = iAmSubmitter ? m.opponent_id : m.submitter_id
      const opponentProfile = profileMap[opponentId] ?? { id: opponentId }
      const myScore = myGame?.total_score ?? 0
      const theirScore = theirGame?.total_score ?? 0
      const result = myScore > theirScore ? 'W' : myScore < theirScore ? 'L' : 'T'
      return { ...m, myGame, theirGame, opponentProfile, result }
    })

    setMatches(enriched)
    setLoading(false)
  }, [session.user.id])

  useEffect(() => { load() }, [load])

  return { matches, loading, reload: load }
}
