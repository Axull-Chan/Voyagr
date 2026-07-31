-- pin search_path on the trigger helper too
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- handle_new_user must only ever run via the auth.users trigger, never as a direct RPC call
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- wrap auth.uid() in a subquery everywhere so Postgres evaluates it once (initplan) instead of per-row
alter policy "profiles_select_own" on public.profiles using ((select auth.uid()) = id);
alter policy "profiles_update_own" on public.profiles using ((select auth.uid()) = id);

alter policy "trips_select_own" on public.trips using ((select auth.uid()) = user_id);
alter policy "trips_insert_own" on public.trips with check ((select auth.uid()) = user_id);
alter policy "trips_update_own" on public.trips using ((select auth.uid()) = user_id);
alter policy "trips_delete_own" on public.trips using ((select auth.uid()) = user_id);

alter policy "trip_days_select_own" on public.trip_days using (
  exists (select 1 from public.trips t where t.id = trip_days.trip_id and t.user_id = (select auth.uid()))
);
alter policy "trip_days_insert_own" on public.trip_days with check (
  exists (select 1 from public.trips t where t.id = trip_days.trip_id and t.user_id = (select auth.uid()))
);
alter policy "trip_days_update_own" on public.trip_days using (
  exists (select 1 from public.trips t where t.id = trip_days.trip_id and t.user_id = (select auth.uid()))
);
alter policy "trip_days_delete_own" on public.trip_days using (
  exists (select 1 from public.trips t where t.id = trip_days.trip_id and t.user_id = (select auth.uid()))
);

alter policy "activities_select_own" on public.activities using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = activities.trip_day_id and t.user_id = (select auth.uid())
  )
);
alter policy "activities_insert_own" on public.activities with check (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = activities.trip_day_id and t.user_id = (select auth.uid())
  )
);
alter policy "activities_update_own" on public.activities using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = activities.trip_day_id and t.user_id = (select auth.uid())
  )
);
alter policy "activities_delete_own" on public.activities using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = activities.trip_day_id and t.user_id = (select auth.uid())
  )
);

alter policy "restaurants_select_own" on public.restaurants using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = restaurants.trip_day_id and t.user_id = (select auth.uid())
  )
);
alter policy "restaurants_insert_own" on public.restaurants with check (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = restaurants.trip_day_id and t.user_id = (select auth.uid())
  )
);
alter policy "restaurants_update_own" on public.restaurants using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = restaurants.trip_day_id and t.user_id = (select auth.uid())
  )
);
alter policy "restaurants_delete_own" on public.restaurants using (
  exists (
    select 1 from public.trip_days d
    join public.trips t on t.id = d.trip_id
    where d.id = restaurants.trip_day_id and t.user_id = (select auth.uid())
  )
);

alter policy "packing_lists_select_own" on public.packing_lists using (
  exists (select 1 from public.trips t where t.id = packing_lists.trip_id and t.user_id = (select auth.uid()))
);
alter policy "packing_lists_insert_own" on public.packing_lists with check (
  exists (select 1 from public.trips t where t.id = packing_lists.trip_id and t.user_id = (select auth.uid()))
);
alter policy "packing_lists_update_own" on public.packing_lists using (
  exists (select 1 from public.trips t where t.id = packing_lists.trip_id and t.user_id = (select auth.uid()))
);
alter policy "packing_lists_delete_own" on public.packing_lists using (
  exists (select 1 from public.trips t where t.id = packing_lists.trip_id and t.user_id = (select auth.uid()))
);

alter policy "budget_breakdown_select_own" on public.budget_breakdown using (
  exists (select 1 from public.trips t where t.id = budget_breakdown.trip_id and t.user_id = (select auth.uid()))
);
alter policy "budget_breakdown_insert_own" on public.budget_breakdown with check (
  exists (select 1 from public.trips t where t.id = budget_breakdown.trip_id and t.user_id = (select auth.uid()))
);
alter policy "budget_breakdown_update_own" on public.budget_breakdown using (
  exists (select 1 from public.trips t where t.id = budget_breakdown.trip_id and t.user_id = (select auth.uid()))
);
alter policy "budget_breakdown_delete_own" on public.budget_breakdown using (
  exists (select 1 from public.trips t where t.id = budget_breakdown.trip_id and t.user_id = (select auth.uid()))
);

alter policy "favorites_select_own" on public.favorites using ((select auth.uid()) = user_id);
alter policy "favorites_insert_own" on public.favorites with check ((select auth.uid()) = user_id);
alter policy "favorites_update_own" on public.favorites using ((select auth.uid()) = user_id);
alter policy "favorites_delete_own" on public.favorites using ((select auth.uid()) = user_id);
