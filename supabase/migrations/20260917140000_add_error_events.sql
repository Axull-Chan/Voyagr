-- Durable error monitoring.
--
-- Vercel keeps runtime logs for only 1 hour on the Hobby plan, and a browser's
-- console is invisible to us, so an error that happens overnight (or on someone
-- else's phone) leaves no trace. This table is the durable record. It is written
-- by report_error() from both the server and the browser, and read only by the
-- project owner (SQL editor / service role) — never by a client.
--
-- One row per distinct problem, not per occurrence. The same error recurring just
-- bumps `occurrences` and `last_seen_at`, so a flood of one failure cannot grow
-- the table, and "what is broken and how often" is one query. A resolved error
-- that comes back is reopened, which is how a regression shows up.
--
-- report_error() has to be callable WITHOUT a login (an error can happen before
-- sign-in), so anyone holding the public key could call it directly. It is built
-- to be safe against that rather than trusting its callers:
--   * every field is truncated;
--   * repeats of one problem only update a counter;
--   * new distinct problems are capped per hour AND in total, so spam can neither
--     flood the table nor grow it without bound (worst case ~5,000 rows);
--   * past those caps it silently does nothing — reporting an error must never
--     itself raise one.
-- The cost of that openness is that an attacker can use up the hourly allowance of
-- new problem types and so hide a genuinely new error for up to an hour. Errors
-- are also still written to the server log, so that window is bounded and visible.

create table public.error_events (
  id bigint generated always as identity primary key,
  fingerprint text not null unique,
  source text not null check (source in ('server', 'client')),
  severity text not null default 'error' check (severity in ('error', 'warning')),
  context text,
  name text,
  message text not null,
  stack text,
  route text,
  digest text,
  app_release text,
  user_agent text,
  last_user_id uuid references auth.users(id) on delete set null,
  occurrences int not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index error_events_last_seen_idx on public.error_events (last_seen_at desc);
create index error_events_first_seen_idx on public.error_events (first_seen_at desc);

-- RLS on with NO policy, and every privilege revoked: clients can neither read
-- nor write the table. The only way in is the function below.
alter table public.error_events enable row level security;
revoke all on public.error_events from anon, authenticated;

create or replace function public.report_error(
  p_source text,
  p_severity text,
  p_context text,
  p_name text,
  p_message text,
  p_stack text,
  p_route text,
  p_digest text,
  p_release text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  max_new_per_hour constant int := 60;
  max_rows constant int := 5000;
  uuid_pattern constant text :=
    '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
  msg text;
  fp text;
  existing_id bigint;
begin
  if p_source not in ('server', 'client') then
    raise exception 'Unknown source.' using errcode = '22023';
  end if;
  if p_severity not in ('error', 'warning') then
    raise exception 'Unknown severity.' using errcode = '22023';
  end if;

  msg := left(coalesce(nullif(btrim(p_message), ''), '(no message)'), 500);

  -- The fingerprint says "same problem": ids and numbers in the message or route
  -- are blanked first, so "trip 4f9c... failed after 31 ms" and "trip a77d...
  -- failed after 9 ms" are one error, not thousands.
  fp := md5(
    p_source || '|' ||
    coalesce(left(p_name, 100), '') || '|' ||
    regexp_replace(regexp_replace(msg, uuid_pattern, '#', 'g'), '[0-9]+', '#', 'g') || '|' ||
    regexp_replace(regexp_replace(coalesce(left(p_route, 200), ''), uuid_pattern, '#', 'g'), '[0-9]+', '#', 'g')
  );

  select id into existing_id from public.error_events where error_events.fingerprint = fp;

  if existing_id is not null then
    update public.error_events
    set occurrences = occurrences + 1,
        last_seen_at = now(),
        resolved_at = null, -- a resolved error that recurs is a regression
        app_release = coalesce(left(p_release, 40), app_release),
        last_user_id = coalesce(auth.uid(), last_user_id)
    where id = existing_id;
    return;
  end if;

  -- A new kind of problem. Housekeeping first, then the caps.
  delete from public.error_events where last_seen_at < now() - interval '30 days';

  if (select count(*) from public.error_events) >= max_rows then
    return;
  end if;
  if (select count(*) from public.error_events
      where first_seen_at > now() - interval '1 hour') >= max_new_per_hour then
    return;
  end if;

  insert into public.error_events (
    fingerprint, source, severity, context, name, message, stack, route,
    digest, app_release, user_agent, last_user_id
  ) values (
    fp, p_source, p_severity,
    left(p_context, 50), left(p_name, 100), msg, left(p_stack, 4000),
    left(p_route, 200), left(p_digest, 100), left(p_release, 40),
    left(p_user_agent, 200), auth.uid()
  )
  on conflict (fingerprint) do update
    set occurrences = public.error_events.occurrences + 1,
        last_seen_at = now(),
        resolved_at = null;
end;
$$;

-- Executable by anon on purpose: an error can happen before anyone has signed in.
revoke all on function public.report_error(text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.report_error(text, text, text, text, text, text, text, text, text, text) to anon, authenticated;
