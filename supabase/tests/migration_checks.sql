-- Behavioral checks for the Quest Coder migration against real Postgres.
-- Run after supabase_stubs.sql and the migration (applied twice for idempotency).
\set ON_ERROR_STOP on

insert into auth.users(id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b')
on conflict do nothing;

do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  clear jsonb := '{"challengeId":"patience-last-jump","baseXp":25,"shards":0}';
  boss jsonb := '{"challengeId":"boss-old-bramblehorn","baseXp":125,"shards":1,"review":{"packSlug":"forest-of-patience-climbing-stairs","topic":"1-DP","schedule":[1,3,7,14,30]}}';
  result jsonb;
  p jsonb;
begin
  -- First clear grants a reward; a repeat clear grants nothing and does not double XP.
  result := quest_coder.quest_coder_apply_clear(a, clear);
  assert result->'grant'->>'xp' = '25', format('first clear grant: %s', result);
  assert result->'progress'->'cleared'->>'patience-last-jump' = 'true', 'clear recorded';
  result := quest_coder.quest_coder_apply_clear(a, clear);
  assert result->'grant' = 'null'::jsonb, format('repeat clear must not grant: %s', result->'grant');
  assert (result->'progress'->'rewards'->>'xp')::int = 25, 'xp granted once';
  assert jsonb_array_length(result->'progress'->'rewards'->'grants') = 1, 'one grant recorded';

  -- Solution-assisted clear is scaled by the multiplier.
  perform quest_coder.quest_coder_record_solution(a, 'patience-route-scroll');
  result := quest_coder.quest_coder_apply_clear(a, '{"challengeId":"patience-route-scroll","baseXp":30,"shards":0,"solutionMultiplier":0.5}');
  assert result->'grant'->>'xp' = '15', format('solution-assisted xp: %s', result->'grant');

  -- Boss clear grants a shard and schedules a review; the shard can be spent once.
  result := quest_coder.quest_coder_apply_clear(a, boss);
  assert (result->'progress'->'rewards'->>'shards')::int = 1, 'boss shard';
  assert result->'progress'->'reviews'->'forest-of-patience-climbing-stairs'->>'bossId' = 'boss-old-bramblehorn', 'review scheduled';
  p := quest_coder.quest_coder_unlock_shop_preview(a);
  assert (p->'rewards'->>'shopPreviewUnlocked')::boolean, 'shop unlocked';
  p := quest_coder.quest_coder_unlock_shop_preview(a);
  assert (p->'rewards'->>'shards')::int = 0, 'shard spent once';

  -- Hints are capped by the pack's hint total.
  perform quest_coder.quest_coder_record_hint(a, 'patience-two-slot-pouch', 2);
  perform quest_coder.quest_coder_record_hint(a, 'patience-two-slot-pouch', 2);
  p := quest_coder.quest_coder_record_hint(a, 'patience-two-slot-pouch', 2);
  assert (p->'hintsOpened'->>'patience-two-slot-pouch')::int = 2, 'hints capped';

  -- Client saves merge drafts but can never write clears or rewards.
  p := quest_coder.quest_coder_merge_client_progress(a, '{"savedCode":{"patience-last-jump":"# draft"},"savedCodeVersions":{"patience-last-jump":0},"cleared":{"boss-old-bramblehorn":false},"rewards":{"xp":999999}}');
  assert p->'savedCode'->>'patience-last-jump' = '# draft', 'draft saved';
  assert p->'cleared'->>'boss-old-bramblehorn' = 'true', 'client cannot erase clears';
  assert (p->'rewards'->>'xp')::int = 165, format('client cannot set xp: %s', p->'rewards'->>'xp');
  -- A stale tab (old revision) cannot overwrite the newer draft.
  p := quest_coder.quest_coder_merge_client_progress(a, '{"savedCode":{"patience-last-jump":"# stale"},"savedCodeVersions":{"patience-last-jump":0}}');
  assert p->'savedCode'->>'patience-last-jump' = '# draft', 'stale draft rejected';

  -- Users are isolated.
  p := quest_coder.quest_coder_read_progress(b);
  assert (p->'rewards'->>'xp')::int = 0 and p->'cleared' = '{}'::jsonb, 'user b starts empty';
end
$$;

-- RLS: an authenticated user reads only their own row; browser roles cannot write or call RPCs.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$
begin
  assert (select count(*) from quest_coder.progress) = 1, 'authenticated sees only own row';
  assert (select user_id from quest_coder.progress) = '00000000-0000-0000-0000-00000000000b', 'own row only';
  begin
    update quest_coder.progress set version = 999;
    raise exception 'authenticated update unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform quest_coder.quest_coder_apply_clear('00000000-0000-0000-0000-00000000000b', '{"challengeId":"x","baseXp":1}');
    raise exception 'authenticated RPC unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

set role anon;
do $$
begin
  begin
    perform 1 from quest_coder.progress;
    raise exception 'anon read unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

\echo 'quest_coder migration checks passed'
