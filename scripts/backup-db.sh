#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# backup-db.sh — dump Postgres dans /var/backups/riposte
# À ajouter au cron : 0 4 * * * /opt/riposte-guild-tool/scripts/backup-db.sh
# ──────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR=/var/backups/riposte
RETENTION_DAYS=14
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U riposte -d riposte --format=custom \
  > "$BACKUP_DIR/riposte-$STAMP.dump"

# Purge backups plus anciens que RETENTION_DAYS jours
find "$BACKUP_DIR" -name 'riposte-*.dump' -mtime +$RETENTION_DAYS -delete

echo "Backup OK : $BACKUP_DIR/riposte-$STAMP.dump"
