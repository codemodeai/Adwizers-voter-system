-- AWE Awards 2026 -- make the emailed voter code optional
--
-- The ballot verified every voter with a 6-digit code emailed through SES.
-- That put an AWS production-access approval between the client and opening
-- voting, which is the wrong thing to be waiting on: the duplicate-vote rules
-- that actually stop a second vote are on the votes table, not in the code.
--
-- What still holds a voter to one vote per nominee, with verification off:
--
--   * votes_nominee_mobile_key -- one vote per mobile number, per nominee
--   * votes_nominee_email_key  -- one per email address (lower-cased), per nominee
--   * votes_nominee_device_key -- one per device id, per nominee
--   * the per-IP-per-minute and per-device-per-hour rate limits
--   * Turnstile, before any row is written
--
-- What is given up, stated plainly: nobody proves the email address is theirs,
-- so a determined voter can invent a fresh address per vote. The device id and
-- the mobile number still block that on one browser and one number, and the
-- rate limits still cap the pace -- but the email signal is now as strong as
-- the honesty of whoever types it.
--
-- Off by default: this migration exists to unblock voting, and turning
-- verification on is the deliberate act, not leaving it on.
alter table public.voting_settings
  add column if not exists require_email_verification boolean not null default false;

-- Deliberately no grant to anon. Whether verification is on shapes the ballot's
-- own copy, which is rendered server-side; the browser never needs to ask.

comment on column public.voting_settings.require_email_verification is
  'When true the ballot emails a 6-digit code and holds the vote until it is entered. Off by default -- the duplicate-vote rules on public.votes stand on their own, and requiring a code makes voting depend on SES being able to send.';
