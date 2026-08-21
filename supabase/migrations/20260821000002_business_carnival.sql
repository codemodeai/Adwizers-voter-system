-- AWE Awards 2026 -- Adwizers Business Carnival stall registrations
--
-- Stall entries are the same kind of thing as award entries: a woman with a
-- business, her contact details, a photo, and a fee to agree to. They go in the
-- applicants table beside the award entries with form_type telling them apart,
-- which is what lets the admin list show them as two tabs of one screen.
--
-- Nothing here rewrites a row. The new columns are nullable, form_type defaults
-- to the only kind of entry that existed until now, and the columns the stall
-- form does not ask for stop being required only for stall rows -- award rows
-- keep every guarantee they had, enforced by the check constraint at the end.

create type public.form_type as enum ('award', 'stall');

alter table public.applicants
  add column if not exists form_type public.form_type not null default 'award';

-- The stall form asks a different eleven-way category question and no email,
-- so the columns those answers would have filled have to be optional.
alter table public.applicants alter column email                    drop not null;
alter table public.applicants alter column category_id              drop not null;
alter table public.applicants alter column interested_in_nomination drop not null;
alter table public.applicants alter column nomination_declaration_at drop not null;

alter table public.applicants
  -- Q6: the stall category list is its own eleven options, held in
  -- src/lib/carnival.ts rather than the categories table, which exists to give
  -- award categories their voting pages.
  add column if not exists stall_category     text,
  -- Q5, Q8, Q11: about the business, what the stall will show, what it needs
  add column if not exists business_about     text,
  add column if not exists stall_products     text,
  add column if not exists stall_requirements text,
  -- Q12: what she wants out of the event, multiple choice
  add column if not exists stall_goals        text[];

create index applicants_form_type_idx on public.applicants (form_type, created_at desc);

-- An award entry still needs everything it always needed. Written as an
-- implication so it constrains award rows only, and every existing row -- all
-- of them award rows with these columns filled -- already satisfies it.
alter table public.applicants
  add constraint applicants_award_fields_present check (
    form_type <> 'award'
    or (
      email is not null
      and category_id is not null
      and interested_in_nomination is not null
      and nomination_declaration_at is not null
    )
  );

-- A stall entry has to say which stall category it is, and nothing else may.
alter table public.applicants
  add constraint applicants_stall_category_matches_form check (
    (form_type = 'stall' and stall_category is not null)
    or (form_type <> 'stall' and stall_category is null)
  );

comment on column public.applicants.form_type is
  'Which form this entry came from: the awards (Form 1) or the Business Carnival stall booking.';
comment on column public.applicants.stall_category is
  'Stall category slug from STALL_CATEGORIES in src/lib/carnival.ts. Stall entries only.';
comment on column public.applicants.stall_goals is
  'What the applicant wants from the event -- goal slugs from src/lib/carnival.ts.';
