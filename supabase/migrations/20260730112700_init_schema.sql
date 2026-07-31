-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  preferred_currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per user, mirrors auth.users.';

-- trips
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  destination text not null,
  starting_city text,
  start_date date,
  end_date date,
  travelers int not null default 1,
  budget numeric,
  currency text not null default 'USD',
  travel_style text,
  accommodation text,
  transportation text,
  interests text[] not null default '{}',
  additional_notes text,
  status text not null default 'draft' check (status in ('draft','generating','ready','archived')),
  is_favorite boolean not null default false,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trips_user_id_idx on public.trips(user_id);

-- trip_days
create table public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_number int not null,
  date date,
  summary text,
  daily_budget numeric,
  daily_cost numeric,
  created_at timestamptz not null default now(),
  unique (trip_id, day_number)
);
create index trip_days_trip_id_idx on public.trip_days(trip_id);

-- activities
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references public.trip_days(id) on delete cascade,
  time_slot text check (time_slot in ('morning','afternoon','evening')),
  title text not null,
  description text,
  location_name text,
  lat double precision,
  lng double precision,
  start_time time,
  duration_minutes int,
  travel_time_minutes int,
  walking_distance_km numeric,
  estimated_cost numeric,
  category text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index activities_trip_day_id_idx on public.activities(trip_day_id);

-- restaurants
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references public.trip_days(id) on delete cascade,
  meal_type text check (meal_type in ('breakfast','lunch','dinner')),
  name text not null,
  cuisine text,
  rating numeric,
  price_level int,
  distance_km numeric,
  opening_hours text,
  google_maps_url text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);
create index restaurants_trip_day_id_idx on public.restaurants(trip_day_id);

-- packing_lists
create table public.packing_lists (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text,
  item text not null,
  is_checked boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index packing_lists_trip_id_idx on public.packing_lists(trip_id);

-- budget_breakdown
create table public.budget_breakdown (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text not null check (category in ('hotels','transportation','food','activities','shopping','emergency_fund')),
  planned_amount numeric not null default 0,
  actual_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (trip_id, category)
);
create index budget_breakdown_trip_id_idx on public.budget_breakdown(trip_id);

-- favorites
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  name text not null,
  type text,
  lat double precision,
  lng double precision,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index favorites_user_id_idx on public.favorites(user_id);
create index favorites_trip_id_idx on public.favorites(trip_id);

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

-- auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_days enable row level security;
alter table public.activities enable row level security;
alter table public.restaurants enable row level security;
alter table public.packing_lists enable row level security;
alter table public.budget_breakdown enable row level security;
alter table public.favorites enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "trips_select_own" on public.trips for select using (auth.uid() = user_id);
create policy "trips_insert_own" on public.trips for insert with check (auth.uid() = user_id);
create policy "trips_update_own" on public.trips for update using (auth.uid() = user_id);
create policy "trips_delete_own" on public.trips for delete using (auth.uid() = user_id);

create policy "trip_days_select_own" on public.trip_days for select using (
  exists (select 1 from public.trips t where t.id = trip_days.trip_id and t.user_id = auth.uid())
);
create policy "trip_days_insert_own" on public.trip_days for insert with check (
  exists (select 1 from public.trips t where t.id = trip_days.trip_id and t.user_id = auth.uid())
);
create policy "trip_days_update_own" on public.trip_days for update using (
  exists (select 1 from public.trips t where t.id = trip_days.trip_id and t.user_id = auth.uid())
);
create policy "trip_days_delete_own" on public.trip_days for delete using (
  exists (select 1 from public.trips t where t.id = trip_days.trip_id and t.user_id = auth.uid())
);

create policy "activities_select_own" on public.activities for select using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = activities.trip_day_id and t.user_id = auth.uid()
  )
);
create policy "activities_insert_own" on public.activities for insert with check (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = activities.trip_day_id and t.user_id = auth.uid()
  )
);
create policy "activities_update_own" on public.activities for update using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = activities.trip_day_id and t.user_id = auth.uid()
  )
);
create policy "activities_delete_own" on public.activities for delete using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = activities.trip_day_id and t.user_id = auth.uid()
  )
);

create policy "restaurants_select_own" on public.restaurants for select using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = restaurants.trip_day_id and t.user_id = auth.uid()
  )
);
create policy "restaurants_insert_own" on public.restaurants for insert with check (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = restaurants.trip_day_id and t.user_id = auth.uid()
  )
);
create policy "restaurants_update_own" on public.restaurants for update using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = restaurants.trip_day_id and t.user_id = auth.uid()
  )
);
create policy "restaurants_delete_own" on public.restaurants for delete using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = restaurants.trip_day_id and t.user_id = auth.uid()
  )
);

create policy "packing_lists_select_own" on public.packing_lists for select using (
  exists (select 1 from public.trips t where t.id = packing_lists.trip_id and t.user_id = auth.uid())
);
create policy "packing_lists_insert_own" on public.packing_lists for insert with check (
  exists (select 1 from public.trips t where t.id = packing_lists.trip_id and t.user_id = auth.uid())
);
create policy "packing_lists_update_own" on public.packing_lists for update using (
  exists (select 1 from public.trips t where t.id = packing_lists.trip_id and t.user_id = auth.uid())
);
create policy "packing_lists_delete_own" on public.packing_lists for delete using (
  exists (select 1 from public.trips t where t.id = packing_lists.trip_id and t.user_id = auth.uid())
);

create policy "budget_breakdown_select_own" on public.budget_breakdown for select using (
  exists (select 1 from public.trips t where t.id = budget_breakdown.trip_id and t.user_id = auth.uid())
);
create policy "budget_breakdown_insert_own" on public.budget_breakdown for insert with check (
  exists (select 1 from public.trips t where t.id = budget_breakdown.trip_id and t.user_id = auth.uid())
);
create policy "budget_breakdown_update_own" on public.budget_breakdown for update using (
  exists (select 1 from public.trips t where t.id = budget_breakdown.trip_id and t.user_id = auth.uid())
);
create policy "budget_breakdown_delete_own" on public.budget_breakdown for delete using (
  exists (select 1 from public.trips t where t.id = budget_breakdown.trip_id and t.user_id = auth.uid())
);

create policy "favorites_select_own" on public.favorites for select using (auth.uid() = user_id);
create policy "favorites_insert_own" on public.favorites for insert with check (auth.uid() = user_id);
create policy "favorites_update_own" on public.favorites for update using (auth.uid() = user_id);
create policy "favorites_delete_own" on public.favorites for delete using (auth.uid() = user_id);
