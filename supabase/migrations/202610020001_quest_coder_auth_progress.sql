-- Quest Coder Supabase progress store.
-- Idempotent: safe to re-run in the Supabase SQL editor or CLI migrations.

create schema if not exists quest_coder;
revoke all on schema quest_coder from public, anon, authenticated;
grant usage on schema quest_coder to service_role, authenticated;

create table if not exists quest_coder.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  version bigint not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table quest_coder.progress enable row level security;
revoke all on quest_coder.progress from public, anon, authenticated;
grant select on quest_coder.progress to authenticated;
grant all on quest_coder.progress to service_role;

drop policy if exists quest_coder_progress_select_own on quest_coder.progress;
create policy quest_coder_progress_select_own
  on quest_coder.progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function quest_coder.quest_coder_empty_progress()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'version', 0,
    'cleared', '{}'::jsonb,
    'solutionOpened', '{}'::jsonb,
    'hintsOpened', '{}'::jsonb,
    'attempts', '{}'::jsonb,
    'savedCode', '{}'::jsonb,
    'savedCodeVersions', '{}'::jsonb,
    'lastChallengeVersion', 0,
    'reviews', '{}'::jsonb,
    'rewards', jsonb_build_object('xp', 0, 'shards', 0, 'grants', '[]'::jsonb, 'shopPreviewUnlocked', false),
    'friendsEnabled', false
  );
$$;

create or replace function quest_coder.quest_coder_ensure_progress(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into quest_coder.progress(user_id, payload)
  values (p_user_id, quest_coder.quest_coder_empty_progress())
  on conflict (user_id) do nothing;
$$;

create or replace function quest_coder.quest_coder_read_progress(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform quest_coder.quest_coder_ensure_progress(p_user_id);
  select payload || jsonb_build_object('version', version)
    into result
    from quest_coder.progress
    where user_id = p_user_id;
  return result;
end;
$$;

create or replace function quest_coder.quest_coder_merge_client_progress(p_user_id uuid, p_client jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_payload jsonb;
  row_version bigint;
  next_payload jsonb;
  next_attempts jsonb;
  next_code jsonb;
  next_code_versions jsonb;
  challenge_id text;
  incoming_value jsonb;
  current_revision bigint;
  expected_revision bigint;
  merged_attempts jsonb;
  incoming_last_challenge text;
  current_last_challenge_version bigint;
  expected_last_challenge_version bigint;
  changed boolean := false;
begin
  perform quest_coder.quest_coder_ensure_progress(p_user_id);
  select payload, version into row_payload, row_version
    from quest_coder.progress where user_id = p_user_id for update;

  next_payload := row_payload;
  next_attempts := coalesce(row_payload->'attempts', '{}'::jsonb);
  next_code := coalesce(row_payload->'savedCode', '{}'::jsonb);
  next_code_versions := coalesce(row_payload->'savedCodeVersions', '{}'::jsonb);

  if jsonb_typeof(p_client->'attempts') = 'object' then
    for challenge_id, incoming_value in select key, value from jsonb_each(p_client->'attempts') loop
      if jsonb_typeof(incoming_value) = 'array' then
        select coalesce(jsonb_agg(item order by source_order, item_order), '[]'::jsonb)
          into merged_attempts
          from (
            select distinct on (coalesce(item->>'id', item::text)) item, source_order, item_order
            from (
              select item, 0 as source_order, ordinality as item_order
                from jsonb_array_elements(incoming_value) with ordinality as incoming(item, ordinality)
              union all
              select item, 1 as source_order, ordinality as item_order
                from jsonb_array_elements(coalesce(next_attempts->challenge_id, '[]'::jsonb)) with ordinality as existing(item, ordinality)
            ) candidates
            order by coalesce(item->>'id', item::text), source_order, item_order
          ) deduplicated
          where source_order * 1000000 + item_order <= 1000015;
        select coalesce(jsonb_agg(item order by item_order), '[]'::jsonb)
          into merged_attempts
          from (
            select item, item_order
              from jsonb_array_elements(merged_attempts) with ordinality as final(item, item_order)
              order by item_order
              limit 15
          ) capped;
        if merged_attempts is distinct from coalesce(next_attempts->challenge_id, '[]'::jsonb) then changed := true; end if;
        next_attempts := jsonb_set(next_attempts, array[challenge_id], merged_attempts, true);
      end if;
    end loop;
  end if;

  if jsonb_typeof(p_client->'savedCode') = 'object' then
    for challenge_id, incoming_value in select key, value from jsonb_each(p_client->'savedCode') loop
      if jsonb_typeof(incoming_value) = 'string' and octet_length(incoming_value #>> '{}') <= 24000 then
        current_revision := coalesce((next_code_versions->>challenge_id)::bigint, 0);
        expected_revision := coalesce((p_client->'savedCodeVersions'->>challenge_id)::bigint, 0);
        if expected_revision = current_revision and next_code->challenge_id is distinct from incoming_value then
          next_code := jsonb_set(next_code, array[challenge_id], incoming_value, true);
          next_code_versions := jsonb_set(next_code_versions, array[challenge_id], to_jsonb(current_revision + 1), true);
          changed := true;
        end if;
      end if;
    end loop;
  end if;

  if jsonb_typeof(p_client->'friendsEnabled') = 'boolean'
     and coalesce((row_payload->>'friendsEnabled')::boolean, false) is distinct from (p_client->>'friendsEnabled')::boolean then
    next_payload := jsonb_set(next_payload, '{friendsEnabled}', p_client->'friendsEnabled', true);
    changed := true;
  end if;

  if jsonb_typeof(p_client->'lastChallengeId') = 'string' then
    incoming_last_challenge := p_client->>'lastChallengeId';
    current_last_challenge_version := coalesce((row_payload->>'lastChallengeVersion')::bigint, 0);
    expected_last_challenge_version := coalesce((p_client->>'lastChallengeVersion')::bigint, 0);
    if expected_last_challenge_version = current_last_challenge_version
       and row_payload->>'lastChallengeId' is distinct from incoming_last_challenge then
      next_payload := jsonb_set(next_payload, '{lastChallengeId}', to_jsonb(incoming_last_challenge), true);
      next_payload := jsonb_set(next_payload, '{lastChallengeVersion}', to_jsonb(current_last_challenge_version + 1), true);
      changed := true;
    end if;
  end if;

  next_payload := jsonb_set(jsonb_set(next_payload, '{attempts}', next_attempts, true), '{savedCode}', next_code, true);
  next_payload := jsonb_set(next_payload, '{savedCodeVersions}', next_code_versions, true);
  if changed then row_version := row_version + 1; end if;
  next_payload := jsonb_set(next_payload, '{version}', to_jsonb(row_version), true);

  update quest_coder.progress set payload = next_payload, version = row_version, updated_at = now() where user_id = p_user_id;
  return next_payload;
end;
$$;

create or replace function quest_coder.quest_coder_record_hint(p_user_id uuid, p_challenge_id text, p_hint_total integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_payload jsonb;
  row_version bigint;
  opened integer;
begin
  perform quest_coder.quest_coder_ensure_progress(p_user_id);
  select payload, version into row_payload, row_version from quest_coder.progress where user_id = p_user_id for update;
  opened := least(greatest(p_hint_total, 0), coalesce((row_payload->'hintsOpened'->>p_challenge_id)::integer, 0) + 1);
  row_version := row_version + 1;
  row_payload := jsonb_set(row_payload, array['hintsOpened', p_challenge_id], to_jsonb(opened), true);
  row_payload := jsonb_set(row_payload, '{version}', to_jsonb(row_version), true);
  update quest_coder.progress set payload = row_payload, version = row_version, updated_at = now() where user_id = p_user_id;
  return row_payload;
end;
$$;

create or replace function quest_coder.quest_coder_record_solution(p_user_id uuid, p_challenge_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare row_payload jsonb; row_version bigint;
begin
  perform quest_coder.quest_coder_ensure_progress(p_user_id);
  select payload, version into row_payload, row_version from quest_coder.progress where user_id = p_user_id for update;
  if coalesce((row_payload->'solutionOpened'->>p_challenge_id)::boolean, false) then return row_payload || jsonb_build_object('version', row_version); end if;
  row_version := row_version + 1;
  row_payload := jsonb_set(row_payload, array['solutionOpened', p_challenge_id], 'true'::jsonb, true);
  row_payload := jsonb_set(row_payload, '{version}', to_jsonb(row_version), true);
  update quest_coder.progress set payload = row_payload, version = row_version, updated_at = now() where user_id = p_user_id;
  return row_payload;
end;
$$;

create or replace function quest_coder.quest_coder_unlock_shop_preview(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare row_payload jsonb; row_version bigint; shards integer;
begin
  perform quest_coder.quest_coder_ensure_progress(p_user_id);
  select payload, version into row_payload, row_version from quest_coder.progress where user_id = p_user_id for update;
  shards := coalesce((row_payload->'rewards'->>'shards')::integer, 0);
  if coalesce((row_payload->'rewards'->>'shopPreviewUnlocked')::boolean, false) or shards < 1 then
    return row_payload || jsonb_build_object('version', row_version);
  end if;
  row_version := row_version + 1;
  row_payload := jsonb_set(row_payload, '{rewards,shards}', to_jsonb(shards - 1), true);
  row_payload := jsonb_set(row_payload, '{rewards,shopPreviewUnlocked}', 'true'::jsonb, true);
  row_payload := jsonb_set(row_payload, '{version}', to_jsonb(row_version), true);
  update quest_coder.progress set payload = row_payload, version = row_version, updated_at = now() where user_id = p_user_id;
  return row_payload;
end;
$$;

create or replace function quest_coder.quest_coder_apply_clear(p_user_id uuid, p_clear jsonb, p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_payload jsonb;
  row_version bigint;
  challenge_id text := p_clear->>'challengeId';
  hint_count integer;
  solution_assisted boolean;
  factor numeric;
  xp integer;
  shards integer := coalesce((p_clear->>'shards')::integer, 0);
  reward_grant jsonb := null;
  grants jsonb;
  review_input jsonb := p_clear->'review';
  pack_slug text;
  existing_review jsonb;
  schedule jsonb;
  prior_days integer;
  interval_days integer;
  changed boolean := false;
begin
  if challenge_id is null or challenge_id = '' then raise exception 'challengeId is required'; end if;
  perform quest_coder.quest_coder_ensure_progress(p_user_id);
  select payload, version into row_payload, row_version from quest_coder.progress where user_id = p_user_id for update;
  hint_count := coalesce((row_payload->'hintsOpened'->>challenge_id)::integer, 0);
  solution_assisted := coalesce((row_payload->'solutionOpened'->>challenge_id)::boolean, false);

  if not coalesce((row_payload->'cleared'->>challenge_id)::boolean, false) then
    factor := case when solution_assisted then coalesce((p_clear->>'solutionMultiplier')::numeric, 0.5)
                   when hint_count > 0 then coalesce((p_clear->>'hintMultiplier')::numeric, 1)
                   else 1 end;
    xp := greatest(5, round(coalesce((p_clear->>'baseXp')::numeric, 0) * factor)::integer);
    reward_grant := jsonb_build_object(
      'id', challenge_id || '-first-clear', 'at', to_char(p_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'challengeId', challenge_id, 'xp', xp, 'shards', shards,
      'reason', case when review_input is not null then 'boss reward grant' else 'quest reward grant' end
    );
    row_payload := jsonb_set(row_payload, array['cleared', challenge_id], 'true'::jsonb, true);
    row_payload := jsonb_set(row_payload, '{rewards,xp}', to_jsonb(coalesce((row_payload->'rewards'->>'xp')::integer, 0) + xp), true);
    row_payload := jsonb_set(row_payload, '{rewards,shards}', to_jsonb(coalesce((row_payload->'rewards'->>'shards')::integer, 0) + shards), true);
    select coalesce(jsonb_agg(value order by ordering), '[]'::jsonb)
      into grants
      from (
        select value, ordering
          from (
            select reward_grant as value, 0::bigint as ordering
            union all
            select value, ordinality
              from jsonb_array_elements(coalesce(row_payload->'rewards'->'grants', '[]'::jsonb)) with ordinality
          ) all_grants
          order by ordering
          limit 20
      ) values_to_keep;
    row_payload := jsonb_set(row_payload, '{rewards,grants}', grants, true);
    changed := true;
  end if;

  if jsonb_typeof(review_input) = 'object' then
    pack_slug := review_input->>'packSlug';
    existing_review := row_payload->'reviews'->pack_slug;
    if existing_review is null or p_now >= (existing_review->>'nextDueAt')::timestamptz then
      schedule := coalesce(review_input->'schedule', '[1,3,7,14,30]'::jsonb);
      prior_days := coalesce((existing_review->>'intervalDays')::integer, 0);
      if solution_assisted or hint_count > 0 then
        interval_days := greatest(1, least(case when prior_days = 0 then coalesce((schedule->>0)::integer, 1) else prior_days end, case when hint_count >= 2 then 3 else 7 end));
      else
        select coalesce(min(value::integer) filter (where value::integer > prior_days), least(greatest(prior_days * 2, 1), coalesce((schedule->>(jsonb_array_length(schedule)-1))::integer, 30)))
          into interval_days from jsonb_array_elements_text(schedule);
      end if;
      row_payload := jsonb_set(row_payload, array['reviews', pack_slug], jsonb_build_object(
        'packSlug', pack_slug, 'bossId', challenge_id, 'topic', coalesce(review_input->>'topic', ''),
        'intervalDays', interval_days, 'nextDueAt', to_char((p_now + make_interval(days => interval_days)) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'lastOutcome', 'passed', 'streak', coalesce((existing_review->>'streak')::integer, 0) + 1,
        'rating', greatest(0, least(2400, coalesce((existing_review->>'rating')::integer, 1000) + case when solution_assisted or hint_count > 0 then 20 else 80 end))
      ), true);
      changed := true;
    end if;
  end if;

  if changed then row_version := row_version + 1; end if;
  row_payload := jsonb_set(row_payload, '{version}', to_jsonb(row_version), true);
  update quest_coder.progress set payload = row_payload, version = row_version, updated_at = now() where user_id = p_user_id;
  return jsonb_build_object('progress', row_payload, 'grant', reward_grant);
end;
$$;

revoke all on all functions in schema quest_coder from public, anon, authenticated;
grant execute on function quest_coder.quest_coder_read_progress(uuid) to service_role;
grant execute on function quest_coder.quest_coder_merge_client_progress(uuid, jsonb) to service_role;
grant execute on function quest_coder.quest_coder_record_hint(uuid, text, integer) to service_role;
grant execute on function quest_coder.quest_coder_record_solution(uuid, text) to service_role;
grant execute on function quest_coder.quest_coder_unlock_shop_preview(uuid) to service_role;
grant execute on function quest_coder.quest_coder_apply_clear(uuid, jsonb, timestamptz) to service_role;
