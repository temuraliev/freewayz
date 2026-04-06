#!/bin/bash
# Создать ecosystem.config.cjs в корне проекта (если его нет после git clone).
# Запуск: из корня репозитория: bash scripts/server-ecosystem-install.sh

set -e
cd "$(dirname "$0")/.."
CONFIG="ecosystem.config.cjs"
if [ -f "$CONFIG" ]; then
  echo "Файл $CONFIG уже есть."
  exit 0
fi
cat > "$CONFIG" << 'EOF'
module.exports = {
  apps: [
    {
      name: 'admin-bot',
      script: 'scripts/admin-bot/index.mjs',
      cwd: __dirname,
      interpreter: 'node',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'customer-bot',
      script: 'scripts/customer-bot/index.mjs',
      cwd: __dirname,
      interpreter: 'node',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: { NODE_ENV: 'production' },
    },
  ],
};
EOF
echo "Создан $CONFIG. Запуск: npx pm2 start ecosystem.config.cjs"
