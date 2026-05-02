#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# deploy.sh — déploiement / mise à jour sur le VPS
# Usage : ./scripts/deploy.sh [--migrate]
# ──────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"

if [[ ! -f .env ]]; then
  echo "ERREUR : .env manquant. Copier .env.production.example vers .env et le compléter."
  exit 1
fi

echo "→ git pull"
git pull --ff-only

echo "→ build"
$COMPOSE build

echo "→ up -d"
$COMPOSE up -d

if [[ "${1:-}" == "--migrate" ]]; then
  echo "→ migrations Drizzle"
  $COMPOSE exec server pnpm --filter server db:migrate
fi

echo "→ statut"
$COMPOSE ps

echo "→ logs (Ctrl+C pour quitter, les containers continuent)"
$COMPOSE logs -f --tail=50
