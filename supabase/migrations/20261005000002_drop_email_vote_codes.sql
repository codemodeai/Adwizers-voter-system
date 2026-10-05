-- AWE Awards 2026 -- remove the emailed voter code (optional cleanup)
--
-- The ballot no longer emails a 6-digit code: the feature was removed from
-- the app at the client's request. This drops what it left behind in the
-- database:
--
--   * public.vote_sessions -- held one row per code sent. The feature was
--     never switched on, so the table is empty (0 rows on 2026-10-05).
--   * voting_settings.require_email_verification -- the on/off switch (false)
--   * voting_settings.verify_session_minutes     -- how long a code lasted (45)
--
-- No vote, nominee or applicant is touched.
--
-- RUN THIS ONLY AFTER the app version without the code feature is deployed.
-- The previous version's Settings screen still writes both columns, and would
-- fail to save if they were gone. Skipping this migration entirely is also
-- fine: the app no longer reads any of it.

drop table if exists public.vote_sessions;

-- voting_settings_limits_positive checks the rate limits AND
-- verify_session_minutes in one constraint. Dropping the column would silently
-- drop the whole constraint, rate-limit guards included -- so it is dropped
-- explicitly here and rebuilt without the removed column.
alter table public.voting_settings
  drop constraint if exists voting_settings_limits_positive;

alter table public.voting_settings
  drop column if exists require_email_verification,
  drop column if exists verify_session_minutes;

alter table public.voting_settings
  add constraint voting_settings_limits_positive check (
    rate_limit_per_ip_per_minute   > 0
    and rate_limit_per_device_per_hour > 0
    and (max_selections_per_submit is null or max_selections_per_submit > 0)
  );
