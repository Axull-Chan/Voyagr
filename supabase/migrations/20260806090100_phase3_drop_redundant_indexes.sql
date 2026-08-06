-- The composite indexes added in phase3_itinerary_tables lead with the same
-- column as these three, and a composite on (a, b) already serves lookups on
-- (a) alone. Keeping both just costs write throughput and storage on every
-- insert.
drop index if exists public.trips_user_id_idx;
drop index if exists public.trip_days_trip_id_idx;
drop index if exists public.activities_trip_day_id_idx;
