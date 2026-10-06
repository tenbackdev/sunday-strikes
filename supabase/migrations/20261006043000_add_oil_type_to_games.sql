-- Oil type: 'house' or 'sport'. Named oil_type (not oil_pattern) to leave room for a
-- future column holding the specific named pattern.
alter table public.games
  add column if not exists oil_type text not null default 'house';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'games_oil_type_check'
  ) then
    alter table public.games
      add constraint games_oil_type_check check (oil_type in ('house', 'sport'));
  end if;
end $$;

-- One-time backfill: games bowled on a Tuesday (US Eastern) were the summer sport league.
-- Day is judged in Eastern time because Tuesday-night games are stored as Wednesday in UTC.
update public.games
   set oil_type = 'sport'
 where extract(dow from played_at at time zone 'America/New_York') = 2;

create index if not exists games_user_oil_type_played_idx
  on public.games (user_id, oil_type, played_at desc);

-- create_vs_match: accept oil_type on each game payload (defaults to 'house').
CREATE OR REPLACE FUNCTION public.create_vs_match(p_submitter_game jsonb, p_opponent_game jsonb, p_opponent_id uuid, p_played_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$DECLARE
  v_submitter_id UUID := auth.uid();
  v_my_game      games;
  v_opp_game     games;
  v_vs_match     vs_matches;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM friend_requests
    WHERE status = 'accepted'
      AND (
        (sender_id = v_submitter_id AND receiver_id = p_opponent_id)
        OR (receiver_id = v_submitter_id AND sender_id = p_opponent_id)
      )
  ) THEN
    RAISE EXCEPTION 'No accepted friendship with opponent';
  END IF;

  INSERT INTO games (user_id, played_at, total_score, player_label, frames, ai_frames, is_vs, oil_type)
  VALUES (
    v_submitter_id,
    p_played_at,
    (p_submitter_game->>'total_score')::int,
    p_submitter_game->>'player_label',
    p_submitter_game->'frames',
    CASE WHEN p_submitter_game ? 'ai_frames' THEN p_submitter_game->'ai_frames' ELSE NULL END,
    false,
    COALESCE(p_submitter_game->>'oil_type', 'house')
  )
  RETURNING * INTO v_my_game;

  INSERT INTO games (user_id, played_at, total_score, player_label, frames, ai_frames, is_vs, oil_type)
  VALUES (
    p_opponent_id,
    p_played_at,
    (p_opponent_game->>'total_score')::int,
    p_opponent_game->>'player_label',
    p_opponent_game->'frames',
    CASE WHEN p_opponent_game ? 'ai_frames' THEN p_opponent_game->'ai_frames' ELSE NULL END,
    false,
    COALESCE(p_opponent_game->>'oil_type', 'house')
  )
  RETURNING * INTO v_opp_game;

  INSERT INTO vs_matches (submitter_id, opponent_id, submitter_game_id, opponent_game_id, played_at)
  VALUES (v_submitter_id, p_opponent_id, v_my_game.id, v_opp_game.id, p_played_at)
  RETURNING * INTO v_vs_match;

  UPDATE games SET is_vs = true, vs_match_id = v_vs_match.id
  WHERE id IN (v_my_game.id, v_opp_game.id);

  INSERT INTO vs_notifications (user_id, vs_match_id)
  VALUES (p_opponent_id, v_vs_match.id)
  ON CONFLICT (user_id, vs_match_id) DO NOTHING;

  RETURN jsonb_build_object(
    'submitter_game_id', v_my_game.id,
    'opponent_game_id',  v_opp_game.id,
    'vs_match_id',       v_vs_match.id
  );
END;$function$;
