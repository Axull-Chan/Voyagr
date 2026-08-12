-- Records where a stay came from, mirroring weather.source.
--
-- A hotel is the one part of an itinerary that can carry a real business name
-- without a real listing behind it: when no accommodation is returned for a
-- destination, the planner falls back to an example. Storing the provenance is
-- what lets the trip page say so on every later visit, rather than only in the
-- notice shown once at creation time.
--
-- The default backfills existing rows as 'mock', which is accurate — every
-- hotel written before this column existed came from the example catalogue.
alter table public.hotels
  add column source text not null default 'mock';

comment on column public.hotels.source is
  'Origin of this stay: a places provider id for a real listing, or ''mock'' for a planner example.';
