-- Itemized actual spend, tracked separately from budget_breakdown.
--
-- budget_breakdown is one row per category holding a single planned_amount —
-- there is no room in that shape for a date, a description, or more than one
-- entry per category, all of which "log an expense" genuinely needs. Rather
-- than stretch budget_breakdown to fit, actual spend gets its own table;
-- budget_breakdown stays purely the planned side, untouched.
--
-- Same category vocabulary as budget_breakdown (mirrored, not shared via FK,
-- since a check constraint is enough and a join for this would be overkill).
-- Currency is independent of the trip's own currency — someone logs what they
-- actually paid, which may be in local currency; totals are converted to the
-- trip's currency for display using the same Frankfurter-backed service the
-- rest of the app already uses.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text not null check (category in ('hotels','transportation','food','activities','shopping','emergency_fund')),
  amount numeric not null check (amount > 0),
  currency text not null,
  description text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index expenses_trip_id_idx on public.expenses(trip_id);

alter table public.expenses enable row level security;

create policy "expenses_select_own" on public.expenses for select using (
  exists (select 1 from public.trips t where t.id = expenses.trip_id and t.user_id = (select auth.uid()))
);
create policy "expenses_insert_own" on public.expenses for insert with check (
  exists (select 1 from public.trips t where t.id = expenses.trip_id and t.user_id = (select auth.uid()))
);
create policy "expenses_update_own" on public.expenses for update using (
  exists (select 1 from public.trips t where t.id = expenses.trip_id and t.user_id = (select auth.uid()))
);
create policy "expenses_delete_own" on public.expenses for delete using (
  exists (select 1 from public.trips t where t.id = expenses.trip_id and t.user_id = (select auth.uid()))
);
