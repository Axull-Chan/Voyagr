-- Phase 9: chat-based itinerary editing.
--
-- One table: a flat, trip-scoped, append-only log of the conversation. Every
-- turn is persisted the moment it happens — including a not-yet-applied
-- assistant proposal — because storing the exchange is not the same as
-- mutating the itinerary: nothing here touches trip_days/activities/
-- restaurants until a second, explicit "apply" action runs (see
-- chat.actions.ts). A discarded proposal needs no special representation:
-- it's simply a row whose applied_at stays null forever, exactly as valid a
-- history entry as one the traveller acted on.
--
-- Same conventions as phase3_itinerary_tables/expenses: cascade from the
-- owning trip, RLS with auth.uid() wrapped in a subquery, one policy per CRUD
-- verb. A composite (trip_id, created_at) index already serves a plain
-- trip_id lookup via its leftmost prefix, so no separate single-column index
-- is added alongside it (the same correction phase3_drop_redundant_indexes
-- made to the Phase 3 tables).
create table public.trip_chat_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  -- Present only on an assistant row that proposed a change; the resolved
  -- ChatOperation[] union (real ids, real venue facts) — never the model's
  -- raw synthetic-ref-id response. See src/lib/ai/types.ts.
  proposed_operations jsonb,
  -- Which provider produced an assistant row (gemini/mock/openai); null for a
  -- user row. Mirrors weather.source / hotels.source.
  provider_id text,
  -- Set once, by the apply action, never after.
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  constraint trip_chat_messages_applied_requires_operations
    check (applied_at is null or proposed_operations is not null),
  constraint trip_chat_messages_operations_is_array
    check (proposed_operations is null or jsonb_typeof(proposed_operations) = 'array')
);

create index trip_chat_messages_trip_id_created_at_idx
  on public.trip_chat_messages(trip_id, created_at);

alter table public.trip_chat_messages enable row level security;

create policy "trip_chat_messages_select_own" on public.trip_chat_messages for select using (
  exists (select 1 from public.trips t where t.id = trip_chat_messages.trip_id and t.user_id = (select auth.uid()))
);
create policy "trip_chat_messages_insert_own" on public.trip_chat_messages for insert with check (
  exists (select 1 from public.trips t where t.id = trip_chat_messages.trip_id and t.user_id = (select auth.uid()))
);
create policy "trip_chat_messages_update_own" on public.trip_chat_messages for update using (
  exists (select 1 from public.trips t where t.id = trip_chat_messages.trip_id and t.user_id = (select auth.uid()))
);
create policy "trip_chat_messages_delete_own" on public.trip_chat_messages for delete using (
  exists (select 1 from public.trips t where t.id = trip_chat_messages.trip_id and t.user_id = (select auth.uid()))
);
