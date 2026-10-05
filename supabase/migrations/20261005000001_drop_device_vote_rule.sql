-- AWE Awards 2026 -- drop the one-vote-per-device rule
--
-- At the client's request, a device no longer limits voting: several people
-- sharing one phone (a family, a shop counter) can each vote for the same
-- nominee. What still holds a voter to one vote per nominee:
--
--   * votes_nominee_mobile_key -- one vote per mobile number, per nominee.
--     The app now stores every number in one standard form (+919876543210),
--     so the same phone typed with spaces, a 0 or +91 is still one voter.
--   * votes_nominee_email_key  -- one per email address (lower-cased), per nominee
--   * the per-IP-per-minute and per-device-per-hour rate limits
--
-- Safe on live data: this removes an index and nothing else. No vote row is
-- read, changed or deleted. device_id is still recorded on every vote (and
-- still drives the hourly per-device rate limit); it just no longer has to be
-- unique per nominee.
--
-- Can run before or after the code deploy. Before the deploy, the old code
-- simply stops seeing device clashes; after it, nothing references the index.

drop index if exists public.votes_nominee_device_key;

comment on column public.votes.device_id is
  'Self-declared browser id (cookie + localStorage). Recorded for review and the per-device hourly rate limit; deliberately NOT unique per nominee since 2026-10-05.';
