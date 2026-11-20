-- Moves a whole trip to a new start date, keeping its length, in one
-- transaction.
--
-- A trip's dates live in five places (the trip, each day, the stay's check-in
-- and check-out, and any transport times), and the Supabase client has no
-- transactions: shifting them one call at a time could leave a trip whose days
-- disagree with its own dates if a call failed halfway. This does it all or
-- nothing, the same reason `duplicate_trip` is a function.
--
-- What moves, by the same number of days: trips.start_date / end_date,
-- trip_days.date, hotels.check_in_date / check_out_date, and
-- transportation.depart_at / arrive_at (where set). What is cleared: stored
-- weather rows (they describe the old dates; the trip page fetches a live
-- forecast for the new ones) and pending one-click replan proposals (they were
-- worked out for the old dates). What is NOT touched: expenses — their dates
-- are when money was actually spent.
--
-- SECURITY INVOKER: every read and write goes through the caller's own RLS, so
-- another user's trip is simply "not found". The checks mirror the app's own
-- (src/features/trips/services/trip-edit.ts) so a direct call can't do what the
-- app would refuse.

create or replace function public.shift_trip_dates(p_trip_id uuid, p_new_start date)
returns date
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  trip_status text;
  old_start date;
  old_end date;
  offset_days integer;
  new_end date;
begin
  if caller is null then
    raise exception 'You need to be signed in to change a trip''s dates.'
      using errcode = '28000';
  end if;

  -- Lock the row so a concurrent generation or second shift waits for this one.
  select status, start_date, end_date
    into trip_status, old_start, old_end
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Trip not found.' using errcode = 'P0002';
  end if;

  if trip_status = 'generating' then
    raise exception 'This trip is still being generated. Try again in a moment.'
      using errcode = '55000';
  end if;

  if old_start is null or old_end is null then
    raise exception 'This trip has no dates to change.' using errcode = '22023';
  end if;

  if p_new_start is null then
    raise exception 'Choose a new start date.' using errcode = '22023';
  end if;

  if p_new_start = old_start then
    raise exception 'The trip already starts on that date.' using errcode = '22023';
  end if;

  if p_new_start < current_date - 1 then
    raise exception 'The new start date is in the past.' using errcode = '22023';
  end if;

  if p_new_start > (current_date + interval '2 years')::date then
    raise exception 'Trips can start at most two years ahead.' using errcode = '22023';
  end if;

  offset_days := p_new_start - old_start;
  new_end := old_end + offset_days;

  update public.trips
  set start_date = p_new_start, end_date = new_end
  where id = p_trip_id;

  update public.trip_days
  set date = date + offset_days
  where trip_id = p_trip_id and date is not null;

  -- date + integer is null when the date is null, so unset dates stay unset.
  update public.hotels
  set check_in_date = check_in_date + offset_days,
      check_out_date = check_out_date + offset_days
  where trip_id = p_trip_id;

  update public.transportation
  set depart_at = depart_at + make_interval(days => offset_days),
      arrive_at = arrive_at + make_interval(days => offset_days)
  where trip_id = p_trip_id
    and (depart_at is not null or arrive_at is not null);

  delete from public.weather w
  using public.trip_days d
  where w.trip_day_id = d.id and d.trip_id = p_trip_id;

  update public.trip_chat_messages
  set proposed_operations = null,
      content = content || ' (No longer applies: the trip''s dates changed.)'
  where trip_id = p_trip_id
    and provider_id like 'replan:day-%'
    and applied_at is null
    and proposed_operations is not null;

  return new_end;
end;
$$;

-- Supabase grants execute to anon/PUBLIC by default. Only a signed-in owner
-- has anything to shift.
revoke all on function public.shift_trip_dates(uuid, date) from public, anon;
grant execute on function public.shift_trip_dates(uuid, date) to authenticated;
