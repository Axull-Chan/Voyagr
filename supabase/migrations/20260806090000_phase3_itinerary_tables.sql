-- Phase 3: the itinerary tables the trip experience needs beyond the Phase 1
-- core (hotels, transportation, weather, trip_notes).
--
-- Conventions follow the init migration exactly: cascade from the owning trip,
-- an index on every foreign key, RLS on with ownership proven by joining back
-- to trips, and auth.uid() wrapped in a subquery so Postgres evaluates it once
-- per statement (initplan) rather than once per row.

-- ---------------------------------------------------------------- hotels ---
-- A stay, not a per-day row: a hotel spans nights, so it hangs off the trip
-- and carries its own date range.
create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  address text,
  check_in_date date,
  check_out_date date,
  nights int check (nights is null or nights > 0),
  price_per_night numeric check (price_per_night is null or price_per_night >= 0),
  total_cost numeric check (total_cost is null or total_cost >= 0),
  rating numeric check (rating is null or (rating >= 0 and rating <= 5)),
  amenities text[] not null default '{}',
  booking_url text,
  image_url text,
  lat double precision,
  lng double precision,
  -- The stay shown in trip summaries when a trip has several.
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index hotels_trip_id_idx on public.hotels(trip_id);

-- -------------------------------------------------------- transportation ---
-- Legs are trip-scoped because the long-haul ones (the inbound flight) belong
-- to no particular day; trip_day_id is set for legs that do sit inside a day.
create table public.transportation (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  trip_day_id uuid references public.trip_days(id) on delete cascade,
  mode text not null check (mode in ('flight','train','bus','car','ferry','metro','walk','rideshare')),
  provider text,
  from_location text not null,
  to_location text not null,
  depart_at timestamptz,
  arrive_at timestamptz,
  duration_minutes int check (duration_minutes is null or duration_minutes >= 0),
  cost numeric check (cost is null or cost >= 0),
  booking_reference text,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index transportation_trip_id_idx on public.transportation(trip_id);
create index transportation_trip_day_id_idx on public.transportation(trip_day_id);

-- --------------------------------------------------------------- weather ---
-- Exactly one forecast per day, so the uniqueness is the lookup index too.
-- `source` records where the reading came from, which is what lets a real
-- provider replace the mock rows later without a schema change.
create table public.weather (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null unique references public.trip_days(id) on delete cascade,
  condition text not null,
  temp_high_c numeric,
  temp_low_c numeric,
  precipitation_chance int check (
    precipitation_chance is null
    or (precipitation_chance >= 0 and precipitation_chance <= 100)
  ),
  wind_kph numeric check (wind_kph is null or wind_kph >= 0),
  humidity int check (humidity is null or (humidity >= 0 and humidity <= 100)),
  sunrise time,
  sunset time,
  source text not null default 'mock',
  fetched_at timestamptz not null default now()
);

-- ------------------------------------------------------------ trip_notes ---
-- User-authored notes during the trip. Distinct from trips.additional_notes,
-- which is the single brief captured once by the creation wizard.
create table public.trip_notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  trip_day_id uuid references public.trip_days(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trip_notes_trip_id_idx on public.trip_notes(trip_id);
create index trip_notes_trip_day_id_idx on public.trip_notes(trip_day_id);

create trigger trip_notes_set_updated_at
  before update on public.trip_notes
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ RLS ---
alter table public.hotels enable row level security;
alter table public.transportation enable row level security;
alter table public.weather enable row level security;
alter table public.trip_notes enable row level security;

create policy "hotels_select_own" on public.hotels for select using (
  exists (select 1 from public.trips t where t.id = hotels.trip_id and t.user_id = (select auth.uid()))
);
create policy "hotels_insert_own" on public.hotels for insert with check (
  exists (select 1 from public.trips t where t.id = hotels.trip_id and t.user_id = (select auth.uid()))
);
create policy "hotels_update_own" on public.hotels for update using (
  exists (select 1 from public.trips t where t.id = hotels.trip_id and t.user_id = (select auth.uid()))
);
create policy "hotels_delete_own" on public.hotels for delete using (
  exists (select 1 from public.trips t where t.id = hotels.trip_id and t.user_id = (select auth.uid()))
);

create policy "transportation_select_own" on public.transportation for select using (
  exists (select 1 from public.trips t where t.id = transportation.trip_id and t.user_id = (select auth.uid()))
);
create policy "transportation_insert_own" on public.transportation for insert with check (
  exists (select 1 from public.trips t where t.id = transportation.trip_id and t.user_id = (select auth.uid()))
);
create policy "transportation_update_own" on public.transportation for update using (
  exists (select 1 from public.trips t where t.id = transportation.trip_id and t.user_id = (select auth.uid()))
);
create policy "transportation_delete_own" on public.transportation for delete using (
  exists (select 1 from public.trips t where t.id = transportation.trip_id and t.user_id = (select auth.uid()))
);

create policy "weather_select_own" on public.weather for select using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = weather.trip_day_id and t.user_id = (select auth.uid())
  )
);
create policy "weather_insert_own" on public.weather for insert with check (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = weather.trip_day_id and t.user_id = (select auth.uid())
  )
);
create policy "weather_update_own" on public.weather for update using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = weather.trip_day_id and t.user_id = (select auth.uid())
  )
);
create policy "weather_delete_own" on public.weather for delete using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = weather.trip_day_id and t.user_id = (select auth.uid())
  )
);

create policy "trip_notes_select_own" on public.trip_notes for select using (
  exists (select 1 from public.trips t where t.id = trip_notes.trip_id and t.user_id = (select auth.uid()))
);
create policy "trip_notes_insert_own" on public.trip_notes for insert with check (
  exists (select 1 from public.trips t where t.id = trip_notes.trip_id and t.user_id = (select auth.uid()))
);
create policy "trip_notes_update_own" on public.trip_notes for update using (
  exists (select 1 from public.trips t where t.id = trip_notes.trip_id and t.user_id = (select auth.uid()))
);
create policy "trip_notes_delete_own" on public.trip_notes for delete using (
  exists (select 1 from public.trips t where t.id = trip_notes.trip_id and t.user_id = (select auth.uid()))
);

-- ------------------------------------------------------- listing indexes ---
-- The dashboard and /trips both read "my trips, newest first", and the trip
-- page reads days in order. Composite indexes so those are index-only rather
-- than a scan plus sort once a user has real trip volume.
create index trips_user_id_created_at_idx on public.trips(user_id, created_at desc);
create index trip_days_trip_id_day_number_idx on public.trip_days(trip_id, day_number);
create index activities_trip_day_id_sort_order_idx on public.activities(trip_day_id, sort_order);
