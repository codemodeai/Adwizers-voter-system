-- AWE Awards 2026 -- voter email becomes optional
--
-- At the client's request the ballot asks only for name and mobile number;
-- email and location are optional. Location was already nullable. This makes
-- email nullable too: a voter who leaves it blank is stored with NULL.
--
-- What still holds a voter to one vote per nominee:
--   * votes_nominee_mobile_key -- one vote per mobile number, per nominee.
--     Mobile is required, and stored in one standard form (+919876543210).
--   * votes_nominee_email_key  -- one vote per email, per nominee, when an
--     email is given. NULLs never clash in a unique index, so any number of
--     voters can leave it blank.
--
-- votes_email_not_blank stays as it is: a CHECK passes on NULL, so it still
-- refuses an empty-string email while allowing no email at all.
--
-- Safe on live data: no row is read, changed or deleted.
--
-- RUN THIS BEFORE deploying the version with the optional email field. The
-- currently deployed version always sends an email, so it is unaffected; the
-- new version stores NULL for a blank email, which this column must allow.

alter table public.votes alter column voter_email drop not null;

comment on column public.votes.voter_email is
  'Optional since 2026-10-05. Lower-cased when given; NULL when the voter left it blank. One vote per nominee per email applies only when present.';
