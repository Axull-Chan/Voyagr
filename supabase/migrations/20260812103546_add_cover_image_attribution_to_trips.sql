-- Unsplash's API guidelines are licence terms: a displayed photo must credit
-- the photographer and Unsplash, with links carrying referral parameters. The
-- integration already builds that attribution, but only the image URL was
-- persisted, so the credit was lost before it could ever be rendered.
--
-- Nullable throughout: trips created before this, and trips with no photo at
-- all, simply have nothing to credit.
alter table public.trips
  add column cover_image_credit_name text,
  add column cover_image_credit_url text,
  add column cover_image_link text;

comment on column public.trips.cover_image_credit_name is
  'Photographer name for the cover image, required by the image provider''s licence.';
comment on column public.trips.cover_image_credit_url is
  'Photographer profile URL, including the referral parameters the licence requires.';
comment on column public.trips.cover_image_link is
  'Canonical page for the photo itself, including referral parameters.';
