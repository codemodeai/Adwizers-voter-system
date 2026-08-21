-- AWE Awards 2026 -- Nominees (Final Plan sections 4, 5, 6)
--
-- A nominee is the public face of an applicant, and deliberately a separate
-- row rather than a flag on the applicant: section 4 says the admin edits the
-- public-facing copy, photo and category "without touching the original form
-- data". Two tables is what makes that literally true -- polishing a bio here
-- cannot rewrite what she actually submitted, and the applicant row stays the
-- untouched record of her entry.
--
-- Nothing in this migration rewrites or deletes an existing row. It adds one
-- table, its policies, and a grant. The applicants table is not altered at all.

-- ---------------------------------------------------------------------------
-- nominees
-- ---------------------------------------------------------------------------
create table if not exists public.nominees (
  id            uuid primary key default gen_random_uuid(),

  -- One nominee per applicant. `restrict` on purpose: deleting an applicant who
  -- is already a published nominee -- and may already hold votes -- should fail
  -- loudly rather than quietly cascade the nominee away.
  applicant_id  uuid not null unique references public.applicants (id) on delete restrict,

  -- The nominee's own category. Copied from the applicant at promotion, then
  -- editable here: section 5 lets the admin move a nominee to a different
  -- category without altering her submission.
  category_id   bigint not null references public.categories (id) on delete restrict,

  -- Public-facing copy. Seeded from the applicant, then the admin's to polish.
  display_name   text not null,
  business_name  text not null,
  area_location  text,
  bio            text,

  -- Path in the applicant-logos bucket. Starts as the applicant's own upload;
  -- a replacement is written under nominees/ and this points at that instead.
  photo_path     text,

  social_instagram text,
  social_facebook  text,
  social_website   text,
  social_whatsapp  text,

  -- Publish state (section 5). A nominee is published on promotion -- that is
  -- what "the moment the nominee is published" in section 4 refers to -- and
  -- can be pulled back off the category page without being deleted.
  is_published  boolean not null default true,

  -- Card order within a category page. Ties break on created_at.
  sort_order    integer not null default 0,

  -- Resend notification (section 3). Recorded rather than fire-and-forget, so
  -- the dashboard can show who was actually told and offer a resend for the
  -- ones that failed. notify_error holds the last failure reason, or null.
  notified_at   timestamptz,
  notify_email  text,
  notify_error  text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint nominees_display_name_not_blank check (length(btrim(display_name)) > 0),
  constraint nominees_business_name_not_blank check (length(btrim(business_name)) > 0)
);

create index if not exists nominees_category_idx
  on public.nominees (category_id, sort_order, created_at);

create index if not exists nominees_published_idx
  on public.nominees (is_published, category_id);

create index if not exists nominees_applicant_idx
  on public.nominees (applicant_id);

alter table public.nominees enable row level security;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- The admin dashboard, through the signed-in admin's own session.
drop policy if exists nominees_admin_all on public.nominees;
create policy nominees_admin_all on public.nominees
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- The category voting page is public and unauthenticated, so anon reads the
-- cards directly -- but only published nominees, and only in a live category.
-- Everything else on this table (the notification trail, unpublished drafts)
-- stays invisible without a service role or an admin session.
drop policy if exists nominees_public_select on public.nominees;
create policy nominees_public_select on public.nominees
  for select to anon, authenticated
  using (
    is_published
    and exists (
      select 1 from public.categories c
      where c.id = category_id and c.is_active
    )
  );

-- Column-level grant, not a table-level one. RLS decides which *rows* anon may
-- read; it says nothing about columns, so a `select *` from the voting page
-- would otherwise hand every visitor the nominee's notification email and the
-- id of her applicant row. anon gets exactly the columns a card is made of --
-- including the three it filters and orders by -- and nothing else.
grant select (
  id,
  category_id,
  display_name,
  business_name,
  area_location,
  bio,
  photo_path,
  social_instagram,
  social_facebook,
  social_website,
  social_whatsapp,
  is_published,
  sort_order,
  created_at
) on public.nominees to anon;

-- ---------------------------------------------------------------------------
-- updated_at maintenance, same trigger the other tables use
-- ---------------------------------------------------------------------------
drop trigger if exists nominees_touch_updated_at on public.nominees;
create trigger nominees_touch_updated_at
  before update on public.nominees
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
comment on table public.nominees is
  'Public profile of a promoted applicant. Separate from applicants so admin edits to public copy never rewrite the original Form 1 submission (Final Plan section 4).';
comment on column public.nominees.photo_path is
  'Object path in the applicant-logos bucket. Seeded from applicants.logo_path; a replacement uploaded here lives under nominees/.';
comment on column public.nominees.is_published is
  'Whether this nominee appears on her category voting page.';
comment on column public.nominees.notified_at is
  'When the Resend selection email was accepted for delivery. Null means never sent -- see notify_error.';
comment on column public.nominees.notify_error is
  'Last Resend failure for this nominee, or null. Set when promotion succeeded but the email did not.';
