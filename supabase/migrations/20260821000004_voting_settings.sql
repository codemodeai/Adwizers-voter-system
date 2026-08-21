-- AWE Awards 2026 -- Voting Control (Final Plan sections 5 and 10)
--
-- One voting window for the whole awards, plus a manual pause that works
-- independently of it. Section 10: voting auto-locks the moment the end time
-- hits, and the pause exists for handling problems mid-window without
-- destroying the schedule.
--
-- "Auto-locks" is deliberately not a scheduled job. The state is derived from
-- these three values every time it is read, so there is nothing to fire, miss,
-- or retry -- a window that ended while the server was asleep is still closed
-- the instant anyone looks.
--
-- Additive: one new table. Nothing existing is altered.

create table if not exists public.voting_settings (
  -- Single-row table. The check constraint is what makes that true rather than
  -- conventional: a second row cannot be inserted, so no code has to decide
  -- which row is authoritative.
  id         smallint primary key default 1 check (id = 1),

  -- Null means "not scheduled yet", which is a real state the dashboard shows
  -- rather than a missing value to paper over.
  starts_at  timestamptz,
  ends_at    timestamptz,

  -- Independent of the window (section 10). Pausing does not move the dates,
  -- so resuming returns to exactly the schedule that was already set.
  is_paused  boolean not null default false,

  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  -- A window that ends before it starts is never openable; refuse it here so
  -- no UI bug can write a schedule that can never be satisfied.
  constraint voting_settings_window_ordered check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

-- Seed the single row so every read finds it and the dashboard never has to
-- special-case "no settings row yet".
insert into public.voting_settings (id) values (1) on conflict (id) do nothing;

alter table public.voting_settings enable row level security;

drop policy if exists voting_settings_admin_all on public.voting_settings;
create policy voting_settings_admin_all on public.voting_settings
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- The category voting page has to know whether it is open, and telling a
-- visitor when voting opens is useful rather than sensitive.
drop policy if exists voting_settings_public_select on public.voting_settings;
create policy voting_settings_public_select on public.voting_settings
  for select to anon, authenticated
  using (true);

-- Column-level, matching the nominees table: the schedule is public, who
-- changed it and when is not.
grant select (id, starts_at, ends_at, is_paused) on public.voting_settings to anon;

drop trigger if exists voting_settings_touch_updated_at on public.voting_settings;
create trigger voting_settings_touch_updated_at
  before update on public.voting_settings
  for each row execute function private.touch_updated_at();

comment on table public.voting_settings is
  'Single-row voting window and pause switch (Final Plan section 10). Voting state is derived from these values at read time, never by a scheduled job.';
comment on column public.voting_settings.is_paused is
  'Manual pause, independent of the scheduled window. Resuming restores the existing schedule unchanged.';
