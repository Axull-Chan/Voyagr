-- Caps the AI usage limits inside consume_ai_quota.
--
-- consume_ai_quota takes its per-user and site-wide limits as arguments, and
-- signed-in users may call it directly through the API (the app calls it with
-- their own session). So a caller could pass p_user_limit => 100000, confirm
-- each reservation with confirm_ai_quota, and fill the site-wide window by
-- themselves: about 250 calls from one account would block trip generation for
-- everyone for a day. They could never get free model calls this way (only the
-- app calls the model), but they could deny them to everyone else.
--
-- Same signature, same behaviour, same SECURITY DEFINER and grants; the only
-- change is that the limits used are least(requested, ceiling):
--   trip_generation: 20 per user, 1000 site-wide per 24 h
--   chat_message:    100 per user, 2000 site-wide per 24 h
-- The app's own settings (AI_LIMIT_*) can still lower them. These ceilings must
-- match AI_LIMIT_CEILINGS in src/lib/ai/usage-limits.ts.

create or replace function public.consume_ai_quota(
  p_kind text,
  p_user_limit int,
  p_global_limit int
)
returns table (
  allowed boolean,
  reason text,
  usage_id bigint,
  used_count int,
  max_allowed int,
  resets_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  window_start timestamptz := now() - interval '24 hours';
  started_cutoff timestamptz := now() - interval '3 minutes';
  u_used int;
  u_next timestamptz;
  g_used int;
  g_next timestamptz;
  new_id bigint;
  -- The limits the caller asked for, capped by the ceilings below.
  user_limit int;
  global_limit int;
begin
  if caller is null then
    raise exception 'You need to be signed in.' using errcode = '28000';
  end if;
  if p_kind not in ('trip_generation', 'chat_message') then
    raise exception 'Unknown usage kind.' using errcode = '22023';
  end if;
  if p_user_limit is null or p_user_limit < 1
     or p_global_limit is null or p_global_limit < 1 then
    raise exception 'Limits must be positive.' using errcode = '22023';
  end if;

  -- Hard ceilings, whatever the caller passed. Signed-in users can call this
  -- function directly; without these, one account could pass a huge per-user
  -- limit, confirm its reservations, and use up the site-wide allowance for
  -- everyone. Keep equal to AI_LIMIT_CEILINGS in src/lib/ai/usage-limits.ts.
  user_limit := least(p_user_limit, case p_kind when 'trip_generation' then 20 else 100 end);
  global_limit := least(p_global_limit, case p_kind when 'trip_generation' then 1000 else 2000 end);

  -- Serialise every request of one kind, so two concurrent requests cannot both
  -- see room for one more. Held only for the rest of this short transaction.
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || p_kind));

  -- Rows older than the window can never count again; keep the table small.
  delete from public.ai_usage where created_at < now() - interval '2 days';

  -- This user's usage that still counts, and when the soonest of it stops counting.
  select
    count(*)::int,
    min(case when status = 'ok'
             then created_at + interval '24 hours'
             else created_at + interval '3 minutes' end)
  into u_used, u_next
  from public.ai_usage
  where user_id = caller
    and kind = p_kind
    and ((status = 'ok' and created_at > window_start)
      or (status = 'started' and created_at > started_cutoff));

  if u_used >= user_limit then
    return query select false, 'user'::text, null::bigint, u_used, user_limit, u_next;
    return;
  end if;

  select
    count(*)::int,
    min(case when status = 'ok'
             then created_at + interval '24 hours'
             else created_at + interval '3 minutes' end)
  into g_used, g_next
  from public.ai_usage
  where kind = p_kind
    and ((status = 'ok' and created_at > window_start)
      or (status = 'started' and created_at > started_cutoff));

  if g_used >= global_limit then
    return query select false, 'global'::text, null::bigint, g_used, global_limit, g_next;
    return;
  end if;

  insert into public.ai_usage (user_id, kind) values (caller, p_kind)
  returning id into new_id;

  return query select true, null::text, new_id, u_used + 1, user_limit, null::timestamptz;
end;
$$;

-- create or replace keeps existing privileges; restated so this file stands alone.
revoke all on function public.consume_ai_quota(text, int, int) from public, anon;
grant execute on function public.consume_ai_quota(text, int, int) to authenticated;
