-- Phase 10 — trip management: duplicate a trip.
--
-- A trip is nine tables deep (days -> activities/restaurants/weather, plus
-- hotels, transportation, budget, packing, notes). The Supabase client cannot
-- wrap several inserts in a transaction, so doing this from the app would leave
-- a half-copied trip behind on any mid-way failure. A plpgsql function runs as
-- one statement: it either produces a complete copy or none at all.
--
-- SECURITY INVOKER on purpose: every read and write below goes through the
-- caller's own row-level-security policies, so a user can only duplicate a trip
-- they own and can only create rows for themselves. There is no privileged path.
--
-- What is copied: the plan. What is deliberately not:
--   * expenses        — what was actually spent on the original is not spend on
--                       the copy;
--   * chat history    — a conversation about one trip is not about the other;
--   * checked state   — packing items come across unchecked;
--   * favourite flag  — a copy starts unstarred;
--   * actual amounts  — the budget copy starts with nothing spent.

create or replace function public.duplicate_trip(source_trip_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  new_trip_id uuid;
  src_status text;
  old_day record;
  new_day_id uuid;
begin
  if caller is null then
    raise exception 'You need to be signed in to duplicate a trip.'
      using errcode = '28000';
  end if;

  select status into src_status
  from public.trips
  where id = source_trip_id;

  -- RLS hides other people's trips, so "not found" covers both cases and never
  -- reveals that an id exists.
  if not found then
    raise exception 'Trip not found.' using errcode = 'P0002';
  end if;

  -- A trip mid-generation has a half-written itinerary; copying it would
  -- freeze that state into a trip nothing is going to finish.
  if src_status = 'generating' then
    raise exception 'This trip is still being generated. Try again in a moment.'
      using errcode = '55000';
  end if;

  insert into public.trips (
    user_id, title, destination, starting_city, start_date, end_date,
    travelers, budget, currency, travel_style, accommodation, transportation,
    interests, additional_notes, status, is_favorite,
    cover_image_url, cover_image_credit_name, cover_image_credit_url,
    cover_image_link
  )
  select
    caller,
    left('Copy of ' || title, 120),
    destination, starting_city, start_date, end_date,
    travelers, budget, currency, travel_style, accommodation, transportation,
    interests, additional_notes,
    -- An archived original is shelved; its copy is something the user just
    -- asked for, so it comes back active.
    case when status = 'archived' then 'ready' else status end,
    false,
    cover_image_url, cover_image_credit_name, cover_image_credit_url,
    cover_image_link
  from public.trips
  where id = source_trip_id
  returning id into new_trip_id;

  -- Days and everything hanging off a day. Looped rather than set-based because
  -- each child needs its parent's *new* id, which only exists after the insert.
  for old_day in
    select * from public.trip_days
    where trip_id = source_trip_id
    order by day_number
  loop
    insert into public.trip_days (
      trip_id, day_number, date, summary, daily_budget, daily_cost
    )
    values (
      new_trip_id, old_day.day_number, old_day.date, old_day.summary,
      old_day.daily_budget, old_day.daily_cost
    )
    returning id into new_day_id;

    insert into public.activities (
      trip_day_id, time_slot, title, description, location_name, lat, lng,
      start_time, duration_minutes, travel_time_minutes, walking_distance_km,
      estimated_cost, category, sort_order
    )
    select
      new_day_id, time_slot, title, description, location_name, lat, lng,
      start_time, duration_minutes, travel_time_minutes, walking_distance_km,
      estimated_cost, category, sort_order
    from public.activities
    where trip_day_id = old_day.id;

    insert into public.restaurants (
      trip_day_id, meal_type, name, cuisine, rating, price_level, distance_km,
      opening_hours, google_maps_url, lat, lng
    )
    select
      new_day_id, meal_type, name, cuisine, rating, price_level, distance_km,
      opening_hours, google_maps_url, lat, lng
    from public.restaurants
    where trip_day_id = old_day.id;

    insert into public.weather (
      trip_day_id, condition, temp_high_c, temp_low_c, precipitation_chance,
      wind_kph, humidity, sunrise, sunset, source, fetched_at
    )
    select
      new_day_id, condition, temp_high_c, temp_low_c, precipitation_chance,
      wind_kph, humidity, sunrise, sunset, source, fetched_at
    from public.weather
    where trip_day_id = old_day.id;

    -- Rows that belong to a specific day but live in a trip-level table.
    insert into public.transportation (
      trip_id, trip_day_id, mode, provider, from_location, to_location,
      depart_at, arrive_at, duration_minutes, cost, booking_reference, notes,
      sort_order
    )
    select
      new_trip_id, new_day_id, mode, provider, from_location, to_location,
      depart_at, arrive_at, duration_minutes, cost, booking_reference, notes,
      sort_order
    from public.transportation
    where trip_id = source_trip_id and trip_day_id = old_day.id;

    insert into public.trip_notes (trip_id, trip_day_id, body)
    select new_trip_id, new_day_id, body
    from public.trip_notes
    where trip_id = source_trip_id and trip_day_id = old_day.id;
  end loop;

  -- Trip-level rows (no day).
  insert into public.transportation (
    trip_id, trip_day_id, mode, provider, from_location, to_location,
    depart_at, arrive_at, duration_minutes, cost, booking_reference, notes,
    sort_order
  )
  select
    new_trip_id, null, mode, provider, from_location, to_location,
    depart_at, arrive_at, duration_minutes, cost, booking_reference, notes,
    sort_order
  from public.transportation
  where trip_id = source_trip_id and trip_day_id is null;

  insert into public.trip_notes (trip_id, trip_day_id, body)
  select new_trip_id, null, body
  from public.trip_notes
  where trip_id = source_trip_id and trip_day_id is null;

  insert into public.hotels (
    trip_id, name, address, check_in_date, check_out_date, nights,
    price_per_night, total_cost, rating, amenities, booking_url, image_url,
    lat, lng, is_primary, source
  )
  select
    new_trip_id, name, address, check_in_date, check_out_date, nights,
    price_per_night, total_cost, rating, amenities, booking_url, image_url,
    lat, lng, is_primary, source
  from public.hotels
  where trip_id = source_trip_id;

  insert into public.budget_breakdown (
    trip_id, category, planned_amount, actual_amount
  )
  select new_trip_id, category, planned_amount, 0
  from public.budget_breakdown
  where trip_id = source_trip_id;

  insert into public.packing_lists (
    trip_id, category, item, is_checked, sort_order
  )
  select new_trip_id, category, item, false, sort_order
  from public.packing_lists
  where trip_id = source_trip_id;

  return new_trip_id;
end;
$$;

-- Supabase grants execute to anon/PUBLIC by default. This function does
-- nothing useful without a signed-in caller, so don't expose it to anyone else.
revoke all on function public.duplicate_trip(uuid) from public, anon;
grant execute on function public.duplicate_trip(uuid) to authenticated;
