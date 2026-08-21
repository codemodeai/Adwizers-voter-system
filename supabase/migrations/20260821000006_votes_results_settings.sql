-- AWE Awards 2026 -- votes, results, and voting rules
-- Ref: Final Plan sections 7, 8, 9, 11, 12
--
-- The ballot UI is still to come, but Analytics, Results and Export are
-- meaningless without somewhere for votes to live, and the duplicate-vote rules
-- belong on the table rather than in the code that will eventually write to it.
-- Section 8 is explicit about why: a check-then-insert done as two app steps
-- lets two near-simultaneous votes both pass the check before either saves.
-- Putting uniqueness on the table closes that gap completely.
--
-- Additive throughout. Nothing existing is dropped or rewritten.

-- ---------------------------------------------------------------------------
-- votes
-- ---------------------------------------------------------------------------
create table if not exists public.votes (
  id            uuid primary key default gen_random_uuid(),

  -- Votes are scoped to the nominee, not the category (section 7): a voter may
  -- back several nominees in one category, but each of them only once.
  nominee_id    uuid   not null references public.nominees (id)   on delete cascade,
  -- Denormalised from the nominee so a category tally never needs the join, and
  -- so moving a nominee between categories cannot silently rewrite history.
  category_id   bigint not null references public.categories (id) on delete restrict,

  -- Collected once per submission (section 6)
  voter_name     text not null,
  voter_mobile   text not null,
  voter_email    text not null,
  voter_location text,

  -- The three duplicate-vote signals (section 8)
  device_id     text not null,
  ip_hash       text,

  -- The receipt shown back to the voter, one per nominee voted for
  vote_ref      text not null unique,

  created_at    timestamptz not null default now(),

  constraint votes_mobile_not_blank check (length(btrim(voter_mobile)) > 0),
  constraint votes_email_not_blank  check (length(btrim(voter_email))  > 0),
  constraint votes_device_not_blank check (length(btrim(device_id))    > 0)
);

-- Section 8's three rules, as three separate indexes on the same table. Each is
-- scoped to the nominee; whichever clashes first refuses the insert, and the
-- app records that nominee as skipped rather than failing the whole submission.
create unique index if not exists votes_nominee_mobile_key
  on public.votes (nominee_id, voter_mobile);

-- Lower-cased: Priya@x.com and priya@x.com are one inbox and must be one vote.
create unique index if not exists votes_nominee_email_key
  on public.votes (nominee_id, lower(voter_email));

create unique index if not exists votes_nominee_device_key
  on public.votes (nominee_id, device_id);

create index if not exists votes_category_idx on public.votes (category_id);
create index if not exists votes_nominee_idx  on public.votes (nominee_id);
create index if not exists votes_created_idx  on public.votes (created_at desc);

alter table public.votes enable row level security;

drop policy if exists votes_admin_all on public.votes;
create policy votes_admin_all on public.votes
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Section 9: vote counts are hidden at the database level, not merely in the
-- UI. anon gets nothing at all here -- no policy and no grant -- so there is no
-- public API route that can count votes, not even indirectly.
revoke all on public.votes from anon;

-- ---------------------------------------------------------------------------
-- vote_attempts -- blocked attempts, logged rather than discarded (sections 8, 9)
-- ---------------------------------------------------------------------------
create table if not exists public.vote_attempts (
  id             uuid primary key default gen_random_uuid(),
  nominee_id     uuid references public.nominees (id) on delete set null,
  category_id    bigint references public.categories (id) on delete set null,

  -- Which of the three signals matched an existing vote, or why else it was
  -- refused: 'mobile' | 'email' | 'device' | 'rate_limit' | 'captcha' | 'closed'
  matched_signal text not null,

  voter_mobile   text,
  voter_email    text,
  device_id      text,
  ip_hash        text,

  created_at     timestamptz not null default now()
);

create index if not exists vote_attempts_created_idx on public.vote_attempts (created_at desc);
create index if not exists vote_attempts_nominee_idx on public.vote_attempts (nominee_id);

alter table public.vote_attempts enable row level security;

drop policy if exists vote_attempts_admin_all on public.vote_attempts;
create policy vote_attempts_admin_all on public.vote_attempts
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.vote_attempts from anon;

-- ---------------------------------------------------------------------------
-- published_winners -- the Reveal snapshot (section 11)
-- ---------------------------------------------------------------------------
-- The winner page is a snapshot written when the admin publishes, not a live
-- query over votes. That is what lets the public page exist at all while
-- section 9's rule holds: the ranking becomes public, the counts never do.
create table if not exists public.published_winners (
  id           bigint generated always as identity primary key,
  category_id  bigint not null references public.categories (id) on delete cascade,
  nominee_id   uuid   not null references public.nominees (id)   on delete cascade,
  rank         smallint not null check (rank between 1 and 5),
  published_at timestamptz not null default now(),

  unique (category_id, nominee_id),
  unique (category_id, rank)
);

create index if not exists published_winners_category_idx
  on public.published_winners (category_id, rank);

alter table public.published_winners enable row level security;

drop policy if exists published_winners_admin_all on public.published_winners;
create policy published_winners_admin_all on public.published_winners
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Public, because publishing is precisely the act of making it public.
drop policy if exists published_winners_public_select on public.published_winners;
create policy published_winners_public_select on public.published_winners
  for select to anon, authenticated
  using (true);

grant select (id, category_id, nominee_id, rank, published_at)
  on public.published_winners to anon;

-- ---------------------------------------------------------------------------
-- voting_settings -- reveal state and the voting rules (sections 8, 11)
-- ---------------------------------------------------------------------------
alter table public.voting_settings
  -- Null means results have never been revealed. Section 11: nothing is shown
  -- publicly before the admin publishes.
  add column if not exists results_published_at timestamptz,
  add column if not exists results_published_by uuid references auth.users (id) on delete set null,

  -- Section 8's thresholds, editable rather than hardcoded so they can be
  -- tightened during a live vote without a deploy. Defaults are the plan's.
  add column if not exists rate_limit_per_ip_per_minute    integer not null default 3,
  add column if not exists rate_limit_per_device_per_hour  integer not null default 20,
  add column if not exists verify_session_minutes          integer not null default 45,
  -- Null means no cap: section 7 allows voting for every nominee in a category.
  add column if not exists max_selections_per_submit       integer;

alter table public.voting_settings
  drop constraint if exists voting_settings_limits_positive;
alter table public.voting_settings
  add constraint voting_settings_limits_positive check (
    rate_limit_per_ip_per_minute   > 0
    and rate_limit_per_device_per_hour > 0
    and verify_session_minutes between 5 and 240
    and (max_selections_per_submit is null or max_selections_per_submit > 0)
  );

-- The public page needs to know whether results are out; it must not learn the
-- thresholds, which are the fraud settings.
grant select (id, status, results_published_at) on public.voting_settings to anon;

comment on table public.votes is
  'One row per nominee voted for. Three unique indexes enforce section 8''s duplicate rules at the database, closing the race a check-then-insert would leave open.';
comment on table public.vote_attempts is
  'Refused vote attempts, kept for admin review (section 9) rather than silently discarded.';
comment on table public.published_winners is
  'Snapshot of the Top 5 per category, written when an admin reveals results. Public ranking without public counts.';
