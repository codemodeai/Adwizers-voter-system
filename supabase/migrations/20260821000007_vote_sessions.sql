-- AWE Awards 2026 -- voter verification sessions (Final Plan sections 6 and 8)
--
-- Section 8 verifies the email once per visit, not once per vote: a voter
-- enters one code and it unlocks voting for the rest of the session, across
-- categories. That is what keeps the number of codes sent proportional to
-- visitors rather than to votes.
--
-- The session lives in the database rather than in a signed cookie because the
-- code attempts have to be counted somewhere the browser cannot reach. A cookie
-- holds only the session id; everything that decides anything is here.

create table if not exists public.vote_sessions (
  id          uuid primary key default gen_random_uuid(),

  email       text not null,
  -- Never the code itself. A leaked backup should not be a list of live codes.
  code_hash   text not null,

  -- Wrong-code attempts. Five and the session is spent, so a six-digit code
  -- cannot be walked through at leisure.
  attempts    smallint not null default 0,

  verified_at timestamptz,
  expires_at  timestamptz not null,

  -- Carried for rate limiting and for the abuse trail section 9 asks for.
  ip_hash     text,
  device_id   text,

  created_at  timestamptz not null default now(),

  constraint vote_sessions_email_not_blank check (length(btrim(email)) > 0)
);

create index if not exists vote_sessions_email_idx   on public.vote_sessions (lower(email), expires_at desc);
create index if not exists vote_sessions_expires_idx on public.vote_sessions (expires_at);
create index if not exists vote_sessions_ip_idx      on public.vote_sessions (ip_hash, created_at desc);

alter table public.vote_sessions enable row level security;

drop policy if exists vote_sessions_admin_all on public.vote_sessions;
create policy vote_sessions_admin_all on public.vote_sessions
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- The voter never talks to this table directly. Every read and write goes
-- through a server action holding the service role, exactly like the entry
-- form's inserts -- so anon gets nothing, and a session cannot be forged or
-- inspected from a browser.
revoke all on public.vote_sessions from anon;

-- Rate limiting counts recent rows by these two signals, so both need to be
-- cheap to filter on.
create index if not exists votes_ip_recent_idx     on public.votes (ip_hash, created_at desc);
create index if not exists votes_device_recent_idx on public.votes (device_id, created_at desc);

comment on table public.vote_sessions is
  'One verification session per visitor per visit (section 8). Holds a hash of the emailed code, never the code.';
comment on column public.vote_sessions.attempts is
  'Wrong-code attempts. The session is spent at five, so a 6-digit code cannot be brute-forced.';
