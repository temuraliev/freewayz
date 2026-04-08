#!/usr/bin/env bash
# Sanity dataset daily backup script.
#
# Install on VPS:
#   1. Copy this file to /opt/freewayz/scripts/maintenance/backup-sanity.sh
#   2. chmod +x /opt/freewayz/scripts/maintenance/backup-sanity.sh
#   3. Install Sanity CLI globally: npm install -g @sanity/cli
#   4. Login once: sanity login --token $SANITY_API_TOKEN
#   5. Add to crontab:
#        30 3 * * * /opt/freewayz/scripts/maintenance/backup-sanity.sh >> /var/log/freewayz-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/freewayz/backups/sanity}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
ENV_FILE="${ENV_FILE:-/opt/freewayz/.env.local}"

# Load env vars
if [ -f "$ENV_FILE" ]; then
  export $(grep -E '^(NEXT_PUBLIC_SANITY_PROJECT_ID|NEXT_PUBLIC_SANITY_DATASET|SANITY_API_TOKEN)=' "$ENV_FILE" | xargs -d '\n' 2>/dev/null || true)
fi

PROJECT_ID="${NEXT_PUBLIC_SANITY_PROJECT_ID:-}"
DATASET="${NEXT_PUBLIC_SANITY_DATASET:-production}"
TOKEN="${SANITY_API_TOKEN:-}"

if [ -z "$PROJECT_ID" ] || [ -z "$TOKEN" ]; then
  echo "ERROR: NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_API_TOKEN not set" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%F_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/sanity-$DATASET-$TIMESTAMP.tar.gz"

echo "[$(date)] Starting Sanity dataset export to $BACKUP_FILE"

# Use Sanity CLI export (pipes NDJSON + assets into tar.gz)
SANITY_AUTH_TOKEN="$TOKEN" npx -y @sanity/cli dataset export "$DATASET" "$BACKUP_FILE" \
  --project "$PROJECT_ID" \
  --no-drafts

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Sanity backup complete: $BACKUP_FILE ($BACKUP_SIZE)"

# Rotate
find "$BACKUP_DIR" -name "sanity-*.tar.gz" -type f -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Rotated Sanity backups older than $RETENTION_DAYS days"

# Optional S3 upload
if [ -n "${BACKUP_S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  aws s3 cp "$BACKUP_FILE" "s3://$BACKUP_S3_BUCKET/sanity/" \
    && echo "[$(date)] Uploaded to S3"
fi
