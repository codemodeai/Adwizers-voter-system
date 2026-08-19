#!/usr/bin/env bash
# Pull, rebuild, and reload the app on the VPS with no downtime.
# Usage:  cd ~/app && ./deploy.sh
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Pulling latest"
git pull --ff-only

echo "==> Installing dependencies"
npm ci

echo "==> Building"
# NEXT_PUBLIC_* values are inlined here, so .env.local must already be correct.
npm run build

echo "==> Reloading"
# reload (not restart) keeps the old process serving until the new one is ready.
pm2 reload awe --update-env

pm2 save
echo "==> Done"
pm2 status awe
