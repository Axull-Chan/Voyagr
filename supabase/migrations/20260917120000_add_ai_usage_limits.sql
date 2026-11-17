-- Usage limits on AI calls (production polish).
--
-- The site is public and every trip generation / chat message spends a shared,
-- free-tier model quota. Anyone with an account could burn it. This adds a
-- per-user limit (fairness) and a global limit (the real backstop), both over a
-- rolling 24 hours.
--
-- Two-step, with NO refund, on purpose. A signed-in user can call any function
-- exposed here directly with their own login, so a "refund" function would let
-- them hand themselves back a slot after every successful generation. Instead:
--
--   1. consume_ai_quota  reserves a slot ('started'). It counts toward the limits
--                        for only 3 minutes — longer than the 150 s the calling
--                        pages are allowed to run, so concurrent requests are still
--                        counted while in flight.
--   2. confirm_ai_quota  is called once the model call has SUCCEEDED and turns it
--                        into 'ok', which counts for the full 24 hours.
--
-- A call that fails or times out is simply never confirmed, so its reservation
-- lapses after 3 minutes and a provider outage does not burn anyone's allowance.
-- Nothing exposed can reduce a user's own usage, only increase it.
--
-- The 24-hour and 3-minute constants are mirrored in src/lib/ai/usage-limits.ts.

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('trip_generation', 'chat_message')),
  status text not null default 'started' check (status in ('started', 'ok')),
  created_at timestamptz not null default now()
);

create index ai_usage_user_kind_created_idx
  on public.ai_usage (user_id, kind, created_at desc);
create index ai_usage_kind_created_idx
  on public.ai_usage (kind, created_at desc);

alter table public.ai_usage enable row level security;

-- A user may read their own usage (so the app can say how much is left). There is
-- deliberately NO insert/update/delete policy: rows are written only by the
-- functions below, never by a client.
create policy "ai_usage_select_own" on public.ai_usage
  for select using ((select auth.uid()) = user_id);

revoke all on public.ai_usage from anon;
revoke insert, update, delete, truncate on public.ai_usage from authenticated;

-- ---------------------------------------------------------------------------
-- consume_ai_quota: check the limits and, if there is room, reserve a slot.
--
-- SECURITY DEFINER because the global limit has to count other users' rows, which
-- RLS hides from the caller. That is safe here because the function never trusts
-- a caller-supplied identity: it uses auth.uid() only, takes no user id argument,
-- and returns nothing about other users beyond a count.
-- ---------------------------------------------------------------------------
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

  if u_used >= p_user_limit then
    return query select false, 'user'::text, null::bigint, u_used, p_user_limit, u_next;
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

  if g_used >= p_global_limit then
    return query select false, 'global'::text, null::bigint, g_used, p_global_limit, g_next;
    return;
  end if;

  insert into public.ai_usage (user_id, kind) values (caller, p_kind)
  returning id into new_id;

  return query select true, null::text, new_id, u_used + 1, p_user_limit, null::timestamptz;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_ai_quota: the model call succeeded, so make the reservation count for
-- the whole window. Touches only the caller's own 'started' rows, and can only
-- ever raise their usage.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_ai_quota(p_usage_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in.' using errcode = '28000';
  end if;

  update public.ai_usage
  set status = 'ok'
  where id = p_usage_id
    and user_id = auth.uid()
    and status = 'started';

  return found;
end;
$$;

-- Supabase grants execute to PUBLIC/anon by default. Neither function does
-- anything for someone who is not signed in.
revoke all on function public.consume_ai_quota(text, int, int) from public, anon;
revoke all on function public.confirm_ai_quota(bigint) from public, anon;
grant execute on function public.consume_ai_quota(text, int, int) to authenticated;
grant execute on function public.confirm_ai_quota(bigint) to authenticated;
