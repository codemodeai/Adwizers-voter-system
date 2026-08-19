-- AWE Awards 2026 -- Phase 1: categories, admins, applicants
-- Ref: docs/AWE_Awards_2026_Final_Plan.pdf sections 3, 4, 5, 15

-- ---------------------------------------------------------------------------
-- Private schema for security-definer helpers (never exposed to the Data API)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- ---------------------------------------------------------------------------
-- admins -- gates the whole dashboard. One row per Supabase Auth user.
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- An admin may read their own row; nothing else touches this table from a client.
create policy admins_self_select on public.admins
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.admins from anon;

-- Security-definer lookup, so admin policies do not recurse through the
-- admins table's own RLS.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- categories -- the 14 award categories (section 15). Each gets its own
-- shareable voting link later, keyed off slug.
-- ---------------------------------------------------------------------------
create table public.categories (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  slug       text not null unique,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_sort_order_idx on public.categories (sort_order, id);

alter table public.categories enable row level security;

-- The public registration form (and later the voter portal) needs the list.
create policy categories_public_select on public.categories
  for select to anon, authenticated
  using (is_active);

create policy categories_admin_all on public.categories
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

insert into public.categories (name, slug, sort_order) values
  ('Home-Based Business',                'home-based-business',      1),
  ('Makeup & Beauty',                    'makeup-beauty',            2),
  ('Hair & Styling',                     'hair-styling',             3),
  ('Mehndi & Aari Work',                 'mehndi-aari-work',         4),
  ('Baking & Food',                      'baking-food',              5),
  ('Resin, Crafts & Gifts',              'resin-crafts-gifts',       6),
  ('Jewellery & Fashion',                'jewellery-fashion',        7),
  ('Boutique & Clothing',                'boutique-clothing',        8),
  ('Digital Creator / Content Creator',  'digital-creator',          9),
  ('Digital Marketing / Graphic Design', 'digital-marketing-design', 10),
  ('Online Yoga / Wellness',             'online-yoga-wellness',     11),
  ('Tuition & Coaching',                 'tuition-coaching',         12),
  ('Handmade Products',                  'handmade-products',        13),
  ('Other',                              'other',                    14);

-- ---------------------------------------------------------------------------
-- applicants -- every Form 1 submission (section 3).
-- Inserts happen server-side via the service role, so anon gets no grant at
-- all: there is no public API route that can read or write this table.
-- ---------------------------------------------------------------------------
create type public.applicant_status as enum (
  'new',
  'payment_received',
  'promoted',
  'rejected'
);

create type public.nomination_interest as enum ('yes', 'maybe');

create table public.applicants (
  id                        uuid primary key default gen_random_uuid(),

  -- Q1-Q5: identity and business
  full_name                 text not null,
  whatsapp_number           text not null,
  email                     text not null,
  area_location             text not null,
  business_name             text not null,
  profession                text not null,

  -- Q6: category. category_other carries the free text when "Other" is picked.
  category_id               bigint not null references public.categories (id) on delete restrict,
  category_other            text,

  -- Q7-Q9: story
  years_in_business         text,
  business_journey          text,
  proudest_achievement      text,

  -- Q10: social links
  social_instagram          text,
  social_facebook           text,
  social_website            text,
  social_whatsapp           text,

  -- Q11: logo / product photo, stored in the applicant-logos bucket
  logo_path                 text,

  -- Q12-Q13
  interested_in_nomination  public.nomination_interest not null,
  wants_whatsapp_updates    boolean not null default false,

  -- Q14-Q16: consent checkboxes, each stored with its own timestamp
  nomination_declaration_at timestamptz not null,
  terms_accepted_at         timestamptz not null,
  communication_consent_at  timestamptz,

  -- admin-side workflow (section 4)
  status                    public.applicant_status not null default 'new',
  payment_received_at       timestamptz,
  admin_notes               text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint applicants_category_other_not_blank check (
    category_other is null or length(btrim(category_other)) > 0
  )
);

create index applicants_created_at_idx  on public.applicants (created_at desc);
create index applicants_status_idx      on public.applicants (status, created_at desc);
create index applicants_category_id_idx on public.applicants (category_id);

alter table public.applicants enable row level security;

create policy applicants_admin_all on public.applicants
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.applicants from anon;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger applicants_touch_updated_at
  before update on public.applicants
  for each row execute function private.touch_updated_at();

create trigger categories_touch_updated_at
  before update on public.categories
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Storage: private bucket for logo / product photos.
-- Uploads and reads both go through the server (service role); admins view
-- images via short-lived signed URLs, so anon needs no storage policy.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'applicant-logos',
  'applicant-logos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
