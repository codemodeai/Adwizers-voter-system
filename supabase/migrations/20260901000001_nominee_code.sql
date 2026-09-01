-- AWE Awards 2026 -- Nominee ID (AWE2026-001)
--
-- A short, human-sayable number for each nominee: the thing an organiser reads
-- out over the phone, writes on a shortlist, or asks a nominee to quote back.
-- It goes in the selection email, so once a row has one it must never change.
--
-- Nominees only. An applicant is a form submission and may never become a
-- nominee; numbering every entry would hand out ids that mean nothing and
-- leave gaps where entries were rejected.
--
-- Nothing here rewrites public copy, votes, or the applicants table. It adds
-- one column, fills it for the nominees that already exist, and puts a default
-- on it so every future promotion is numbered by the database itself.

-- ---------------------------------------------------------------------------
-- The counter
-- ---------------------------------------------------------------------------
-- A sequence rather than "max + 1" computed in the app: two admins promoting
-- at the same instant would both read the same max and mint the same id, and
-- the unique index would then fail one of the promotions outright. nextval is
-- atomic and never hands the same number to two transactions.
create sequence if not exists public.nominee_code_seq as bigint start with 1 increment by 1;

alter table public.nominees add column if not exists code text;

-- ---------------------------------------------------------------------------
-- Backfill, in the order they were promoted
-- ---------------------------------------------------------------------------
-- Numbers follow promotion order, so the earliest nominee is AWE2026-001. Runs
-- before the default exists, so it is the only writer of these values.
with ordered as (
  select id, row_number() over (order by created_at, id) as n
  from public.nominees
  where code is null
)
update public.nominees nm
   set code = 'AWE2026-' || lpad(ordered.n::text, 3, '0')
  from ordered
 where nm.id = ordered.id;

-- Park the counter past what the backfill just handed out. The third argument
-- is is_called: false on an empty table, so the very first promotion still
-- gets 001 rather than 002.
select setval(
  'public.nominee_code_seq',
  greatest((select count(*) from public.nominees), 1),
  (select count(*) from public.nominees) > 0
);

-- ---------------------------------------------------------------------------
-- From here on the database numbers every new nominee
-- ---------------------------------------------------------------------------
-- The default lives in the schema, not in the promote action, so a nominee
-- created by a script, by SQL, or by a future code path is numbered too.
-- lpad to 3 keeps AWE2026-001 tidy without capping anything: the 1000th
-- nominee simply becomes AWE2026-1000.
alter table public.nominees
  alter column code set default 'AWE2026-' || lpad(nextval('public.nominee_code_seq')::text, 3, '0');

alter table public.nominees alter column code set not null;

create unique index if not exists nominees_code_key on public.nominees (code);

-- The default expression runs as the inserting role, and promotion inserts
-- through the signed-in admin's own session -- without this grant every
-- promotion would fail with "permission denied for sequence".
grant usage on sequence public.nominee_code_seq to authenticated, service_role;

-- Tie the sequence's lifetime to the column it feeds.
alter sequence public.nominee_code_seq owned by public.nominees.code;

-- Deliberately no grant to anon. The voting page reads a fixed column list and
-- does not show ids; leaving it ungranted keeps the public surface unchanged.

comment on column public.nominees.code is
  'Public-facing nominee number (AWE2026-001), assigned once by nominee_code_seq at insert and quoted in the selection email. Never reused, never renumbered.';
