#!/usr/bin/env bash
# PostgreSQL daily backup script.
#
# Install on VPS:
#   1. Copy this file to /opt/freewayz/scripts/maintenance/backup-postgres.sh
#   2. chmod +x /opt/freewayz/scripts/maintenance/backup-postgres.sh
#   3. Add to crontab: crontab -e
#        0 3 * * * /opt/freewayz/scripts/maintenance/backup-postgres.sh >> /var/log/freewayz-backup.log 2>&1
#
# Requires: postgresql-client (for pg_dump), gzip
#   apt-get install -y postgresql-client

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/freewayz/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
ENV_FILE="${ENV_FILE:-/opt/freewayz/.env.local}"

# Load DATABASE_URL from .env.local
if [ -f "$ENV_FILE" ]; then
  export $(grep -E '^DATABASE_URL=' "$ENV_FILE" | xargs -d '\n' 2>/dev/null || true)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%F_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/freewayz-$TIMESTAMP.sql.gz"

echo "[$(date)] Starting PostgreSQL backup to $BACKUP_FILE"

# Dump and compress in a single pipe (no intermediate file)
pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip -9 > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup complete: $BACKUP_FILE ($BACKUP_SIZE)"

# Delete backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "freewayz-*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Rotated backups older than $RETENTION_DAYS days"

# Optional: upload to S3/Backblaze B2 if configured
if [ -n "${BACKUP_S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  aws s3 cp "$BACKUP_FILE" "s3://$BACKUP_S3_BUCKET/postgres/" \
    && echo "[$(date)] Uploaded to S3"
fi
