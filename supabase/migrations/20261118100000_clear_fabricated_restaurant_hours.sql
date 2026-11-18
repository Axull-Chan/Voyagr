-- Clear the template "opening hours" that were stored on every restaurant.
--
-- Until now the providers wrote a fixed window per meal type into
-- restaurants.opening_hours ("07:00 - 11:00" for breakfast, "11:30 - 15:00" for
-- lunch, "17:30 - 22:30" for dinner) and the trip page printed it as if it were
-- the venue's own hours. It never came from any source: OpenTripMap's list
-- endpoint carries no hours, and nothing else is wired up. Showing a guessed
-- window as a fact can send someone to a closed restaurant, so the app no longer
-- writes or renders it (see GeneratedRestaurant.openingHours in
-- src/lib/ai/types.ts).
--
-- Every existing non-null value came from that template — there is no way for a
-- user to enter hours, and no other writer — so clearing them all removes nothing
-- that was real. The column stays (nullable) for a future real source.
--
-- Safe to run more than once: the second run updates zero rows.

update public.restaurants
   set opening_hours = null
 where opening_hours is not null;

comment on column public.restaurants.opening_hours is
  'Real opening hours from a venue source, or null. Never a template or estimate: no source supplies hours today, so this is null for every row.';
