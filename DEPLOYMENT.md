# Deploying to a Hostinger VPS

Repo: `git@github.com:codemodeai/Adwizers-voter-system.git`

> **Currently deployed on Vercel as two projects, one per domain** — see
> [DOMAINS.md](DOMAINS.md). This VPS walkthrough is the alternative path and
> describes a **single** server carrying both surfaces. To split the two
> domains here instead, run the app twice (two PM2 processes on two ports, each
> with its own `APP_TARGET` and `FORM_ORIGIN`/`ADMIN_ORIGIN`) behind two Nginx
> `server` blocks — see the note at the end of step 6.

This app needs a **Node.js runtime**. It has four Server Action files, `proxy.ts`
middleware, and admin pages that read auth cookies per request — so Hostinger's
shared / Premium / Business plans (PHP + Apache) cannot run it, and there is no
static-export escape hatch. A VPS is the right call.

**Target:** Ubuntu 24.04 VPS · Node 22 · PM2 · Nginx · Let's Encrypt.

---

## 1. Create the VPS

In hPanel → VPS → choose **Ubuntu 24.04 (plain, no control panel)**. KVM 1
(1 vCPU / 4 GB) is comfortably enough — Next.js idles around 150 MB here, and
all the heavy lifting is Supabase's.

Note the server IP, then SSH in:

```bash
ssh root@YOUR_SERVER_IP
```

## 2. Base setup

Never run the app as root.

```bash
apt update && apt upgrade -y
adduser --disabled-password --gecos "" awe
usermod -aG sudo awe

# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs nginx git

npm install -g pm2
node -v && nginx -v
```

## 3. Give the server read access to the private repo

Generate a **deploy key** on the VPS — it is read-only and scoped to this one
repo, unlike a personal access token.

```bash
su - awe
ssh-keygen -t ed25519 -C "awe-vps" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Copy that public key into GitHub → the repo → **Settings → Deploy keys → Add
deploy key**. Leave "Allow write access" **unchecked**.

```bash
ssh -T git@github.com   # accept the fingerprint; "successfully authenticated" is the pass
```

## 4. Clone and configure

```bash
cd ~
git clone git@github.com:codemodeai/Adwizers-voter-system.git app
cd app
npm ci
```

Create the environment file. **Do not commit this** — it is gitignored for a
reason, and `SUPABASE_SECRET_KEY` bypasses every RLS policy in the database.

```bash
nano .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://kxpdudurctozuqjloisf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=...
```

```bash
chmod 600 .env.local
```

> The two `NEXT_PUBLIC_` values are **inlined at build time**, so they must be in
> place *before* `npm run build`. Change either one later and you must rebuild —
> restarting PM2 alone will not pick it up.

## 5. Build and start

```bash
npm run build
pm2 start npm --name awe -- run start
pm2 save
pm2 startup        # run the sudo line it prints, so PM2 survives a reboot
pm2 logs awe --lines 30
```

The app is now on `127.0.0.1:3000`. Nginx will put it on port 80/443.

## 6. Nginx reverse proxy

```bash
sudo nano /etc/nginx/sites-available/awe
```

```nginx
server {
    listen 80;
    server_name awards.yourdomain.com;

    # Photo uploads reach ~4 MB. Nginx defaults to 1 MB and would reject them
    # with a 413 before the request ever gets to Next.js.
    client_max_body_size 10M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Hashed build assets are immutable; let the browser keep them.
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/awe /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### Splitting the two domains on one VPS

Run the app twice from the same checkout and give each process its own target:

```bash
APP_TARGET=form  FORM_ORIGIN=https://awe.adwizersnetworks.in ADMIN_ORIGIN=https://admin.adwizersnetworks.in   PORT=3000 pm2 start npm --name awe-form  -- run start
APP_TARGET=admin FORM_ORIGIN=https://awe.adwizersnetworks.in ADMIN_ORIGIN=https://admin.adwizersnetworks.in   PORT=3001 pm2 start npm --name awe-admin -- run start
pm2 save
```

Then duplicate the `server` block above: one with `server_name awe.adwizersnetworks.in`
proxying to `127.0.0.1:3000`, one with `server_name admin.adwizersnetworks.in` proxying to
`127.0.0.1:3001`, and run certbot with `-d` for both. A single `npm run build` serves both
processes: the proxy and `robots.txt` both read `APP_TARGET` per request. (The
only build-time-baked values are `NEXT_PUBLIC_*`, which are identical on both
targets.)

## 7. Domain and HTTPS

Point an **A record** for `awards.yourdomain.com` at the VPS IP (hPanel → Domains
→ DNS Zone). Wait for it to resolve, then:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d awards.yourdomain.com
```

Certbot rewrites the Nginx config for TLS and installs a renewal timer.

## 8. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Port 3000 stays closed to the world — only Nginx talks to it.

## 9. Supabase settings

In the Supabase dashboard → **Authentication → URL Configuration**, set
**Site URL** to `https://awards.yourdomain.com`. This only affects links in
auth emails (password reset); password sign-in works regardless.

Nothing else needs changing — the database, RLS policies, and storage bucket are
already live and environment-independent.

---

## Deploying updates

```bash
ssh awe@YOUR_SERVER_IP
cd ~/app
./deploy.sh
```

`deploy.sh` (in this repo) pulls, installs, rebuilds, and reloads PM2 with zero
downtime.

### Optional: deploy automatically on push

Add these as GitHub → Settings → **Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `VPS_HOST` | your server IP |
| `VPS_USER` | `awe` |
| `VPS_SSH_KEY` | a **private** key whose public half is in `~/.ssh/authorized_keys` on the VPS |

Then create `.github/workflows/deploy.yml` with the following. (It is not
committed here because pushing workflow files requires a GitHub token with the
`workflow` scope — easiest is to add it through the GitHub web UI:
**Add file → Create new file**.)

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy over SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd ~/app
            ./deploy.sh
```

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| **502 Bad Gateway** | App is not running. `pm2 logs awe` — usually a missing env var; `src/lib/env.ts` throws by design rather than failing silently. |
| **413 on photo upload** | `client_max_body_size` missing from the Nginx server block (step 6). |
| **Supabase keys changed but nothing happened** | `NEXT_PUBLIC_*` are build-time. Rebuild, don't just restart. |
| **Admin login rejects a valid password** | The account has no row in `public.admins`. Run `node scripts/create-admin.mjs`. |
| **Build killed / OOM** | 1 GB VPS. Add swap: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`. |
