# Two domains, one repo

The public entry form and the admin dashboard run on separate domains as **two
Vercel projects built from this same repository**. No code is duplicated — a
single environment variable, `APP_TARGET`, tells each build which half of the
app it serves.

```
Adwiser-Voter-System (one repo, one codebase)
│
├── Vercel project: awe-form          ├── Vercel project: awe-admin
│     APP_TARGET=form                 │     APP_TARGET=admin
│     → FORM DOMAIN                   │     → ADMIN DOMAIN
│                                     │
│     serves  /                       │     serves  /admin/login
│             /register               │             /admin/applicants
│             /register/thank-you     │             /admin/applicants/[id]
│                                     │
└──── /admin/*  → redirects to ───────┴──── /register → redirects back ────┘
```

---

## Routing behaviour

`src/proxy.ts` decides this on every request, before anything renders.

| Request | Form deployment | Admin deployment |
| --- | --- | --- |
| `/` | landing page | → `/admin` → `/admin/applicants` |
| `/register` | the form | 307 → *form domain* `/register` |
| `/register/thank-you` | confirmation | 307 → *form domain* |
| `/admin/login` | 307 → *admin domain* | sign-in page |
| `/admin/applicants` | 307 → *admin domain* | dashboard (auth required) |
| `/robots.txt` | `Allow: /` | `Disallow: /` |
| **POST** to a foreign route | `404` | `404` |

Two deliberate choices there:

- **Only GET/HEAD redirect.** A `POST` that lands on the wrong domain is a
  Server Action aimed at a page this build does not serve, and the redirect would
  replay its body against another origin. It gets a flat 404 instead.
- **Redirects need the sibling origin.** Until `FORM_ORIGIN` / `ADMIN_ORIGIN`
  are set, off-surface paths return 404 rather than redirecting. That is the
  correct behaviour before the domains exist — nothing breaks, the routes are
  just absent.

---

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** for
**Production and Preview** on each project.

| Variable | Form project | Admin project |
| --- | --- | --- |
| `APP_TARGET` | `form` | `admin` |
| `FORM_ORIGIN` | `https://FORM-DOMAIN` | `https://FORM-DOMAIN` |
| `ADMIN_ORIGIN` | `https://ADMIN-DOMAIN` | `https://ADMIN-DOMAIN` |
| `NEXT_PUBLIC_SUPABASE_URL` | same | same |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same | same |
| `SUPABASE_SECRET_KEY` | same | same |

**Both origins go on both projects** — each deployment has to know where to
send the traffic that is not its own.

Notes:

- `SUPABASE_SECRET_KEY` is needed on *both*. The public form uses it to insert
  the applicant row and upload the logo (the `applicants` table grants `anon`
  nothing); the admin editor uses it for storage writes.
- Bare hostnames work too — `admin.example.com` is normalised to
  `https://admin.example.com`.
- **Redeploy after changing any of them.** The proxy reads these per request,
  but statically prerendered output bakes in whatever was set at build time —
  and Vercel does not push new env values into an existing deployment anyway.
- Leaving the two origins **unset in the Preview scope** is a reasonable choice:
  preview builds then 404 on foreign routes instead of bouncing testers out to
  the production domains.

---

## Setting it up on Vercel

The repo is already linked to project `adwiser-voter-system`. Keep it as the
**form** project — it carries the existing public URL — and add a second one.

### 1. Convert the existing project into the form deployment

Vercel → `adwiser-voter-system` → Settings:

- **Environment Variables** → add `APP_TARGET=form`, plus `FORM_ORIGIN` and
  `ADMIN_ORIGIN` once the domains are known.
- **General → Project Name** → rename to `awe-form` (optional, but the pair is
  much easier to tell apart in the dashboard).
- **Domains** → add the form domain, set it as primary.

### 2. Create the admin project from the same repo

Vercel → **Add New → Project** → import the *same* GitHub repository.

Vercel will warn that the repo is already connected to another project — that
is expected and allowed; continue.

- **Project Name:** `awe-admin`
- **Framework Preset:** Next.js (auto-detected)
- **Root Directory:** `./` (unchanged — both projects build the same root)
- **Environment Variables:** the table above, with `APP_TARGET=admin`
- Deploy, then **Domains** → add the admin domain.

Both projects now build on every push to `main`. A change to shared code
redeploys both, which is what you want — they are one codebase.

### 3. DNS

For each domain, Vercel's **Domains** tab prints the exact record. Typically:

| Record | Name | Value |
| --- | --- | --- |
| `A` | `@` (apex) | `76.76.21.21` |
| `CNAME` | subdomain | `cname.vercel-dns.com` |

Use whatever Vercel shows — it is authoritative over this table. Certificates
issue automatically once the records resolve.

### 4. Supabase

**Authentication → URL Configuration:**

- **Site URL** → the **admin** domain. Auth emails (password reset) only ever
  go to admins; the public form does not authenticate anyone.
- **Redirect URLs** → add `https://ADMIN-DOMAIN/**`.

Nothing else changes. The database, RLS policies, and the `applicant-logos`
bucket are environment-independent and already live.

---

## Local development

Unset `APP_TARGET` and both origins in `.env.local` and everything behaves as
it did before the split:

```bash
npm run dev          # whole app, both surfaces, localhost:3000
```

To exercise the split — including the cross-domain redirects — run both halves
in two terminals:

```bash
npm run dev:form     # APP_TARGET=form  → localhost:3000
npm run dev:admin    # APP_TARGET=admin → localhost:3001
```

`scripts/with-target.mjs` points the two origins at those ports automatically in
dev, so `localhost:3000/admin/login` redirects to `localhost:3001/admin/login`
exactly as production will. Verify the production builds with:

```bash
npm run build:form
npm run build:admin
```

---

## What this does and does not isolate

**It does:**

- Separate domains, separate TLS certs, separate deploy and rollback history.
- Separate environment variables — the admin project's config can diverge
  without touching the public form.
- An admin outage cannot take the entry form down, and vice versa.
- **Admin session cookies are now scoped to the admin domain only.** The public
  form's origin can never hold or transmit an admin session — a real
  improvement over the single-domain setup.
- The form deployment skips the Supabase `getUser()` round trip that used to
  run in the proxy ahead of every public page load.

**It does not:**

- Strip the admin code out of the form deployment. Both projects build the
  whole repo; routing decides what each answers. The security boundary is
  unchanged and unchanged-by-design: RLS on every table, the `admins` row
  check in the dashboard layout, and `requireAdmin()` on every server action
  that reaches past RLS. Hostname routing is organisation, not authorisation.

If the admin panel ever needs to ship on a genuinely separate codebase, the
next step is a workspace split (`apps/form`, `apps/admin`, `packages/shared`)
with a per-app Root Directory in Vercel. Nothing here blocks that later.
