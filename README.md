# AWE Awards 2026 — Nomination & Voting Platform

Built to the spec in [`docs/AWE_Awards_2026_Final_Plan.pdf`](docs/AWE_Awards_2026_Final_Plan.pdf).

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage)

---

## Build status

| Phase | Scope | Status |
| --- | --- | --- |
| **1** | Registration form (Form 1) + Applicants module | ✅ Built |
| 2 | Nominees — promote, public profile editing, Resend notification | Not started |
| 3 | Voter portal — category pages, Turnstile, SES codes, vote rules | Not started |
| 4 | Voting control, analytics, winner reveal, export, backup | Not started |

Dashboard modules from plan section 5 that belong to later phases are visible in
the sidebar but marked **Soon**, so the finished shape is clear from day one.

---

## Setup

### 1. Environment

```bash
cp .env.example .env.local
```

Fill in from **Supabase Dashboard → Project Settings → API**:

| Variable | Where it is used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | everywhere |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + admin session (RLS applies) |
| `SUPABASE_SECRET_KEY` | **server only** — public form insert, logo storage |

`SUPABASE_SECRET_KEY` must never gain a `NEXT_PUBLIC_` prefix; it bypasses RLS.

### 2. Database

Run [`supabase/migrations/20260819000001_init_applicants.sql`](supabase/migrations/20260819000001_init_applicants.sql)
in the Supabase SQL Editor. It creates `categories` (seeded with the 14
categories from plan section 15), `applicants`, `admins`, the RLS policies, and
the private `applicant-logos` storage bucket.

### 3. First admin

```bash
node scripts/create-admin.mjs you@example.com "StrongPassword123" "Your Name"
```

A Supabase Auth account alone does not grant access — the dashboard also
requires a matching row in `public.admins`. This script writes both.

### 4. Run

```bash
npm run dev
```

| Route | What it is |
| --- | --- |
| `/register` | Public Form 1 |
| `/register/thank-you` | Post-submit confirmation |
| `/admin/login` | Admin sign in |
| `/admin/applicants` | Applicants list — search, filter, paginate |
| `/admin/applicants/[id]` | Review & edit a submission |

---

## Security model

The applicants table grants `anon` **nothing at all** — there is no public API
route that can read or write it.

- **Public form submit** → Server Action → service-role client. Validated with
  Zod on the server before anything is written; the client-side copy of the
  schema is UX only.
- **Admin reads/writes** → the signed-in admin's own session, so every query
  passes through RLS. `private.is_admin()` is a `SECURITY DEFINER` function in a
  non-exposed schema, with `EXECUTE` revoked from `anon`.
- **Logos** live in a private bucket with no storage policies. Admins view them
  through 10-minute signed URLs; uploads go through the server.
- **Server Actions are addressable endpoints**, so each one that reaches past
  RLS calls `requireAdmin()` rather than trusting the layout guard.
- The category slug used to enforce the *"Other — please specify"* rule is read
  from the database, not the submitted form, so it cannot be spoofed.

## Notes carried from the plan

- **Q11 (logo/photo) is optional**, matching the plan — only the fields the plan
  marks *required* are enforced. Every nominee card needs an image, so expect to
  chase missing photos before promotion.
- **Consent timestamps are read-only** in the admin editor. They are the record
  of what the applicant agreed to at submission, so admins can see them but not
  rewrite them.
- **Marking payment received stamps `payment_received_at`**, and walking the
  status back clears it, so the timestamp can never contradict the status.
- `docs/Flow ref.jpeg` is the earlier marketing infographic and **contradicts the
  final plan** in several places (10 vs 14 categories, per-nominee vs
  per-category links, OTP per vote vs per session). The PDF is authoritative.
