-- Hotel bookings (Phase 1 of in-app hotel booking): the table, its state
-- machine, and guards that stop existing trip features from silently breaking
-- a real reservation.
--
-- A booking is NOT a `hotels` row. `hotels` is plan data: regenerating an
-- itinerary deletes and rewrites it, duplicating a trip copies it, changing
-- dates moves it. A reservation held at a hotel can't follow any of that, so
-- it lives here, outlives even the trip (trip_id is set null on delete), and
-- links to the `hotels` row it fills through hotel_id.
--
-- Writes: only server code with the service-role key writes this table. The
-- signed-in user can read their own rows and nothing else — no insert, update
-- or delete policy exists — so nobody can mark their own booking "booked" by
-- calling the API directly. The triggers below apply to every writer, the
-- service role included: RLS can be bypassed by that key, triggers can't.
--
-- States (src/lib/bookings/booking-state.ts mirrors this list; a test checks):
--   room_selected -> prebooked | failed | cancelled
--   prebooked     -> room_selected | booking | failed | cancelled
--   booking       -> booked | pending_confirmation | failed | room_selected
--   pending_confirmation -> booked | failed
--   booked        -> cancelled
--   failed, cancelled: final.
-- `searching` is page state only; a row starts at room_selected.
-- `booking` exists so two clicks can't both book (compare-and-set from
-- prebooked); `pending_confirmation` exists so a timeout is never recorded as
-- a failure when the provider may have taken the booking.

create table public.hotel_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  hotel_id uuid references public.hotels(id) on delete set null,
  status text not null default 'room_selected' check (status in (
    'room_selected', 'prebooked', 'booking', 'pending_confirmation',
    'booked', 'failed', 'cancelled'
  )),
  mode text not null check (mode in ('sandbox', 'live')),
  provider text not null check (provider in ('liteapi')),
  payment_timing text not null default 'pay_now'
    check (payment_timing in ('pay_now', 'pay_at_hotel')),
  provider_hotel_id text not null,
  hotel_name text not null,
  address text,
  lat double precision,
  lng double precision,
  room_name text,
  board_type text,
  check_in date not null,
  check_out date not null,
  adults int not null check (adults between 1 and 20),
  children int not null default 0 check (children between 0 and 20),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  quoted_total numeric not null check (quoted_total >= 0),
  rate_id text,
  prebook_id text,
  prebook_total numeric check (prebook_total is null or prebook_total >= 0),
  prebook_expires_at timestamptz,
  price_change_accepted_at timestamptz,
  booking_id text,
  confirmation_code text,
  final_total numeric check (final_total is null or final_total >= 0),
  refundable_until timestamptz,
  cancellation_policy jsonb,
  idempotency_key uuid not null unique default gen_random_uuid(),
  guest_first_name text,
  guest_last_name text,
  guest_email text,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  booked_at timestamptz,
  cancelled_at timestamptz,
  check (check_out > check_in),
  -- A booked row always carries the provider's booking id and the price paid.
  check (status <> 'booked' or (booking_id is not null and final_total is not null))
);

create index hotel_bookings_user_id_idx on public.hotel_bookings(user_id);
create index hotel_bookings_trip_id_idx on public.hotel_bookings(trip_id);
create index hotel_bookings_hotel_id_idx on public.hotel_bookings(hotel_id);
create unique index hotel_bookings_provider_booking_idx
  on public.hotel_bookings(provider, booking_id) where booking_id is not null;

comment on table public.hotel_bookings is
  'Hotel reservations made through a booking provider. Written only by the server (service role); users read their own.';

alter table public.hotel_bookings enable row level security;

create policy "hotel_bookings_select_own" on public.hotel_bookings
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.hotel_bookings from anon;
revoke insert, update, delete, truncate on public.hotel_bookings from authenticated;
grant select on public.hotel_bookings to authenticated;

-- The one definition of "active": a booking in flight or held, not yet over.
-- Used by every guard below; booking-guards.ts mirrors it.
create or replace function public.hotel_booking_is_active(p_status text, p_check_out date)
returns boolean
language sql
stable -- reads current_date, so not immutable
set search_path = public
as $$
  select p_status in ('booking', 'pending_confirmation', 'booked')
     and p_check_out >= current_date
$$;

-- ---------------------------------------------------------------- state ----

create or replace function public.hotel_bookings_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  owner uuid;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'room_selected' then
      raise exception 'A booking must start at room_selected, not %.', new.status
        using errcode = '23514';
    end if;
    if new.trip_id is not null then
      select user_id into owner from public.trips where id = new.trip_id;
      if owner is distinct from new.user_id then
        raise exception 'A booking must belong to the owner of its trip.'
          using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE
  if new.user_id <> old.user_id
     or new.idempotency_key <> old.idempotency_key
     or new.mode <> old.mode
     or new.provider <> old.provider
     or new.created_at <> old.created_at then
    raise exception 'user_id, idempotency_key, mode, provider and created_at cannot change.'
      using errcode = '23514';
  end if;
  if new.trip_id is distinct from old.trip_id and new.trip_id is not null then
    raise exception 'A booking cannot move to another trip.' using errcode = '23514';
  end if;

  -- Detaching is always allowed: deleting the trip or the stay sets trip_id /
  -- hotel_id to null (on delete set null), and a final booking must not block
  -- that. Nothing else may change in the same update.
  if (to_jsonb(new) - 'trip_id' - 'hotel_id' - 'updated_at')
       = (to_jsonb(old) - 'trip_id' - 'hotel_id' - 'updated_at')
     and (new.trip_id is null or new.trip_id = old.trip_id)
     and (new.hotel_id is null or new.hotel_id = old.hotel_id) then
    new.updated_at := now();
    return new;
  end if;

  if old.status in ('failed', 'cancelled') then
    raise exception 'A % booking is final and cannot change.', old.status
      using errcode = '55000';
  end if;

  if new.status <> old.status and not (
       (old.status = 'room_selected' and new.status in ('prebooked', 'failed', 'cancelled'))
    or (old.status = 'prebooked' and new.status in ('room_selected', 'booking', 'failed', 'cancelled'))
    or (old.status = 'booking' and new.status in ('booked', 'pending_confirmation', 'failed', 'room_selected'))
    or (old.status = 'pending_confirmation' and new.status in ('booked', 'failed'))
    or (old.status = 'booked' and new.status = 'cancelled')
  ) then
    raise exception 'A booking cannot go from % to %.', old.status, new.status
      using errcode = '55000';
  end if;

  -- Once held, the stay itself is fixed; changing it means a new booking.
  if old.status in ('booked', 'pending_confirmation')
     and (new.check_in <> old.check_in or new.check_out <> old.check_out
          or new.provider_hotel_id <> old.provider_hotel_id
          or new.booking_id is distinct from old.booking_id
          or (old.final_total is not null and new.final_total is distinct from old.final_total)) then
    raise exception 'A held booking''s hotel, dates, booking id and price cannot change.'
      using errcode = '55000';
  end if;

  new.updated_at := now();
  if new.status = 'booked' and old.status <> 'booked' then
    new.booked_at := coalesce(new.booked_at, now());
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;
  return new;
end;
$$;

create trigger hotel_bookings_guard
  before insert or update on public.hotel_bookings
  for each row execute function public.hotel_bookings_guard();

create or replace function public.hotel_bookings_no_delete_active()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.hotel_booking_is_active(old.status, old.check_out) then
    raise exception 'An active hotel booking cannot be deleted. Cancel it first.'
      using errcode = '55000';
  end if;
  return old;
end;
$$;

create trigger hotel_bookings_no_delete_active
  before delete on public.hotel_bookings
  for each row execute function public.hotel_bookings_no_delete_active();

-- --------------------------------------------- guards on existing tables ---

-- Deleting a trip would set its bookings' trip_id to null and remove the stay
-- from view while the hotel still holds the room. SECURITY DEFINER so the check
-- sees every booking on the trip, whoever is deleting; it only reads.
create or replace function public.trips_no_delete_with_active_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.hotel_bookings b
    where b.trip_id = old.id and public.hotel_booking_is_active(b.status, b.check_out)
  ) then
    raise exception 'This trip has an active hotel booking. Cancel the booking before deleting the trip.'
      using errcode = '55000';
  end if;
  return old;
end;
$$;

create trigger trips_no_delete_with_active_booking
  before delete on public.trips
  for each row execute function public.trips_no_delete_with_active_booking();

-- Regenerating an itinerary deletes the trip's stays and rewrites them. The
-- app now spares booked stays (itinerary-writer.ts); this makes that a rule,
-- not a convention.
create or replace function public.hotels_no_delete_booked_stay()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.hotel_bookings b
    where b.hotel_id = old.id and public.hotel_booking_is_active(b.status, b.check_out)
  ) then
    raise exception 'This stay is an active hotel booking. Cancel the booking before removing it.'
      using errcode = '55000';
  end if;
  return old;
end;
$$;

create trigger hotels_no_delete_booked_stay
  before delete on public.hotels
  for each row execute function public.hotels_no_delete_booked_stay();

-- Trigger functions are not callable as RPCs, but revoke anyway so they never
-- appear as executable API surface.
revoke all on function public.hotel_bookings_guard() from public, anon, authenticated;
revoke all on function public.hotel_bookings_no_delete_active() from public, anon, authenticated;
revoke all on function public.trips_no_delete_with_active_booking() from public, anon, authenticated;
revoke all on function public.hotels_no_delete_booked_stay() from public, anon, authenticated;
revoke all on function public.hotel_booking_is_active(text, date) from public, anon;
grant execute on function public.hotel_booking_is_active(text, date) to authenticated;

-- ------------------------------------------- existing functions, updated ---

-- duplicate_trip: unchanged except that a booked stay is not copied (and a
-- primary stay is re-chosen if the booked one was primary).
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
  -- A booked stay belongs to the trip that holds the reservation, never to a
  -- copy: the copy plans the trip, it doesn't own the room.
  where trip_id = source_trip_id and source <> 'booking';

  -- If the booked stay was the primary one, the copy would have none.
  update public.hotels set is_primary = true
  where id = (
    select id from public.hotels where trip_id = new_trip_id
    order by created_at, id limit 1
  )
  and not exists (
    select 1 from public.hotels where trip_id = new_trip_id and is_primary
  );

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


-- shift_trip_dates: unchanged except that it refuses while a booking is
-- active (same wording as booking-guards.ts).
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

  -- A booking is held at the hotel for fixed dates. Moving the trip would
  -- move the stay's dates in the app while the reservation stays put.
  if exists (
    select 1 from public.hotel_bookings b
    where b.trip_id = p_trip_id
      and b.status in ('booking', 'pending_confirmation', 'booked')
      and b.check_out >= current_date
  ) then
    raise exception 'This trip has an active hotel booking. Cancel the booking before changing the dates.'
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

