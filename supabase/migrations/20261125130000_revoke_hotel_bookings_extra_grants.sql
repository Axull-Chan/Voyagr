-- Hardening for hotel_bookings: signed-in users read their own rows and do
-- nothing else. Supabase's default grants also gave them REFERENCES and
-- TRIGGER on the new table; neither is usable through the API, but neither is
-- needed, so the table's surface is exactly SELECT (filtered by RLS).
revoke references, trigger on public.hotel_bookings from authenticated;
