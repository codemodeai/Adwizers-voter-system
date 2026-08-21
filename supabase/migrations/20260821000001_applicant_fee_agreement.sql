-- AWE Awards 2026 -- the registration fee step on Form 1
--
-- The entry form now shows the fee and what it covers, and asks the applicant
-- to agree to pay it before submitting. Both columns are nullable on purpose:
-- applications taken before this step existed keep their rows untouched, and a
-- null fee_agreed_at is the honest record that no such agreement was captured.
--
-- fee_amount_inr stores the price as it stood at submission, so raising the fee
-- later never rewrites what an earlier applicant actually agreed to.

alter table public.applicants
  add column if not exists fee_agreed_at  timestamptz,
  add column if not exists fee_amount_inr integer;

comment on column public.applicants.fee_agreed_at is
  'When the applicant ticked the registration fee agreement on Form 1. Null for entries taken before that step existed.';

comment on column public.applicants.fee_amount_inr is
  'Registration fee in rupees as shown to this applicant at submission.';
