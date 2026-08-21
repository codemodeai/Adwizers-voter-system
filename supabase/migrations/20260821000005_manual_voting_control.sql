-- AWE Awards 2026 -- manual voting control, replacing the scheduled window
--
-- The scheduled start/end from section 10 is gone at the client's direction.
-- Voting is now switched by hand: not started -> open -> paused/stopped, with
-- an additional pause per category so one category can be held while the rest
-- keep running.
--
-- The trade this makes, recorded here because it is not obvious later: nothing
-- closes voting on its own any more. Someone has to press Stop.
--
-- The dropped columns held one expired test window and nothing else -- no
-- applicant, nominee or vote data is touched by this migration.

create type public.voting_status as enum (
  'not_started',  -- never opened; category pages say voting has not opened
  'open',         -- votes accepted
  'paused',       -- temporarily halted, resumes to open
  'stopped'       -- ended by an admin
);

alter table public.voting_settings
  add column if not exists status public.voting_status not null default 'not_started';

-- Carry the one piece of state worth keeping: an explicit pause stays a pause.
-- Anything else -- including the expired test window -- starts clean, which is
-- what "remove all the schedules" asks for.
update public.voting_settings
   set status = case when is_paused then 'paused'::public.voting_status
                     else 'not_started'::public.voting_status end
 where id = 1;

alter table public.voting_settings
  drop constraint if exists voting_settings_window_ordered;

alter table public.voting_settings
  drop column if exists starts_at,
  drop column if exists ends_at,
  drop column if exists is_paused;

-- The public page reads the switch, so anon needs the new column. Column-level,
-- matching the rest: the switch is public, who moved it and when is not.
grant select (id, status) on public.voting_settings to anon;

-- ---------------------------------------------------------------------------
-- Per-category pause
-- ---------------------------------------------------------------------------
-- Deliberately separate from is_active. Hiding a category closes its page
-- entirely and takes it off the entry form; pausing leaves the page and its
-- nominee cards up and only stops votes being cast. Two different intentions,
-- so two different columns.
alter table public.categories
  add column if not exists voting_paused boolean not null default false;

comment on column public.categories.voting_paused is
  'Pauses voting for this category only, while global voting stays open. Distinct from is_active, which closes the page altogether.';

comment on column public.voting_settings.status is
  'Manual voting switch. Nothing changes this on a timer -- voting is opened and stopped by an admin.';
