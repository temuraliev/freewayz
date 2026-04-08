#!/usr/bin/env bash
# FreeWayz server setup script.
# Run on a fresh Ubuntu/Debian VPS as root:
#   curl -fsSL https://raw.githubusercontent.com/temuraliev/freewayz/main/scripts/maintenance/server-setup.sh | bash
# Or locally:
#   bash server-setup.sh

set -euo pipefail

REPO_URL="https://github.com/temuraliev/freewayz.git"
BRANCH="${BRANCH:-main}"
APP_DIR="/opt/freewayz"

echo "==> FreeWayz server setup"
echo "    Repo: $REPO_URL"
echo "    Branch: $BRANCH"
echo "    Dir: $APP_DIR"
echo ""

# ── 1. System packages ─────────────────────────────────────
echo "==> Installing system packages..."
apt-get update -y
apt-get install -y curl git build-essential ca-certificates

# ── 2. Node.js 20 via NodeSource ────────────────────────────
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 20 ]; then
  echo "==> Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "    Node: $(node -v)"
echo "    npm:  $(npm -v)"

# ── 3. PM2 ──────────────────────────────────────────────────
if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> Installing PM2..."
  npm install -g pm2
fi
echo "    PM2: $(pm2 -v)"

# ── 4. Clone or pull repo ───────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  echo "==> Updating existing repo at $APP_DIR..."
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull --ff-only
else
  echo "==> Cloning repo to $APP_DIR..."
  mkdir -p "$APP_DIR"
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 5. Install dependencies ─────────────────────────────────
echo "==> Installing npm dependencies..."
npm ci

# ── 6. Prisma client ────────────────────────────────────────
echo "==> Generating Prisma client..."
npx prisma generate

# ── 7. .env.local template ──────────────────────────────────
if [ ! -f "$APP_DIR/.env.local" ]; then
  echo "==> Creating .env.local template..."
  cat > "$APP_DIR/.env.local" <<'EOF'
# Telegram bot token (from @BotFather)
BOT_TOKEN=
ADMIN_TELEGRAM_IDS=

# App URL (your Vercel deployment)
NEXT_PUBLIC_APP_URL=

# PostgreSQL (same DB as Vercel)
DATABASE_URL=

# Sanity CMS
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=

# 17track (optional)
TRACK17_API_KEY=
EOF
  chmod 600 "$APP_DIR/.env.local"
  echo ""
  echo "=============================================================="
  echo "  !!! Edit $APP_DIR/.env.local and fill in the values !!!"
  echo "  Then run:  pm2 start ecosystem.config.cjs && pm2 save"
  echo "=============================================================="
  exit 0
fi

# ── 8. Start bots ───────────────────────────────────────────
echo "==> Starting bots with PM2..."
pm2 start ecosystem.config.cjs || pm2 restart all
pm2 save

# ── 9. Autostart on reboot ──────────────────────────────────
echo "==> Configuring PM2 autostart..."
pm2 startup systemd -u root --hp /root | tail -n 1 | bash || true

echo ""
echo "==> Done. Status:"
pm2 list

echo ""
echo "Logs:"
echo "  pm2 logs admin-bot"
echo "  pm2 logs customer-bot"
