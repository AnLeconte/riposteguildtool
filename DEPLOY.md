# Déploiement — Riposte Guild Tool

Procédure complète pour déployer la stack sur un **VPS Cloud Infomaniak**
(ou n'importe quel VPS Linux avec Docker).

Stack déployée : Postgres 16 · Redis 7 · Node server (avec SimC compilé) · Caddy (web statique + reverse proxy + HTTPS auto).

---

## 1. Commander le VPS

1. Compte Infomaniak → **Manager** → **Cloud / VPS Cloud**
2. Choisir **VPS Cloud M** (4 vCPU / 8 Go RAM / 80 Go SSD) — minimum recommandé pour SimC
3. OS : **Ubuntu 24.04 LTS**
4. Récupérer l'IP publique (IPv4) du VPS

Note : le VPS Lite (2 Go RAM) ne tiendra pas la compilation initiale de SimC.

## 2. Configurer le DNS

Chez ton registrar (ou panel Infomaniak si le domaine y est) :

| Type | Nom | Valeur |
|------|-----|--------|
| A    | `@` | `<IP du VPS>` |
| A    | `www` | `<IP du VPS>` |

Attendre la propagation (`dig +short riposteguildtool.fr` doit retourner l'IP).

## 3. Préparer le VPS

SSH en root (ou utilisateur avec sudo) :

```bash
ssh root@<IP_VPS>

# Mises à jour
apt update && apt upgrade -y

# Docker + Docker Compose
apt install -y docker.io docker-compose-plugin git

# Firewall (UFW)
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Utilisateur dédié (optionnel mais recommandé)
adduser --disabled-password --gecos "" riposte
usermod -aG docker riposte
```

## 4. Cloner le repo

```bash
mkdir -p /opt && cd /opt
git clone <URL_DU_REPO> riposte-guild-tool
cd riposte-guild-tool
chown -R riposte:riposte /opt/riposte-guild-tool
```

## 5. Créer le fichier `.env`

```bash
cp .env.production.example .env
nano .env
```

À remplir impérativement :
- `DOMAIN`, `ACME_EMAIL`
- `DB_PASSWORD` (généré : `openssl rand -base64 24`)
- `JWT_SECRET` (généré : `openssl rand -base64 32`)
- `BLIZZARD_CLIENT_ID` / `_SECRET` (https://develop.battle.net/access/clients)
- `WCL_CLIENT_ID` / `_SECRET` (https://www.warcraftlogs.com/api/clients/)
- `DISCORD_CLIENT_ID` / `_SECRET` / `BOT_TOKEN` / IDs de channels
- `DISCORD_BOT_API_KEY` (généré : `openssl rand -hex 32`)

URLs de callback à enregistrer côté Blizzard / Discord developer portal :
- Blizzard : `https://<DOMAIN>/api/auth/bnet/callback`
- Discord (login) : `https://<DOMAIN>/api/auth/discord/callback`
- Discord (apply) : `https://<DOMAIN>/api/auth/discord-apply/callback`

## 6. Premier déploiement

```bash
chmod +x scripts/*.sh

# Build (long la 1re fois — SimC compile, prévoir 10–15 min)
docker compose -f docker-compose.prod.yml build

# Démarrage
docker compose -f docker-compose.prod.yml up -d

# Migrations Drizzle
docker compose -f docker-compose.prod.yml exec server pnpm --filter server db:migrate

# Vérifier
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=100
```

Caddy obtient automatiquement le certificat Let's Encrypt au premier démarrage
(visible dans `docker compose logs web`).

Tester : `https://<DOMAIN>` doit afficher l'app.

## 7. Mises à jour

```bash
cd /opt/riposte-guild-tool
./scripts/deploy.sh             # build + restart
./scripts/deploy.sh --migrate   # idem + applique les nouvelles migrations
```

## 8. Backups Postgres

Le script `scripts/backup-db.sh` fait un dump custom dans `/var/backups/riposte`
et purge ceux de +14 jours.

Cron quotidien (root) :
```
crontab -e
```
```
0 4 * * * /opt/riposte-guild-tool/scripts/backup-db.sh >> /var/log/riposte-backup.log 2>&1
```

Pour pousser vers **Swiss Backup** (Infomaniak) ou **kDrive**, ajouter ensuite un
`rclone copy /var/backups/riposte remote:riposte-backups/` après le pg_dump.

Restauration :
```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U riposte -d riposte --clean < /var/backups/riposte/riposte-YYYYMMDD-HHMMSS.dump
```

## 9. Logs & monitoring

```bash
# Logs live
docker compose -f docker-compose.prod.yml logs -f server
docker compose -f docker-compose.prod.yml logs -f web

# Usage CPU/RAM
docker stats

# Espace disque
df -h
docker system df
```

Nettoyage périodique des images orphelines :
```bash
docker system prune -af --volumes=false
```

## 10. Dépannage rapide

| Symptôme | Piste |
|----------|-------|
| Caddy ne sort pas de cert | DNS pas encore propagé, port 80/443 bloqué, `ACME_EMAIL` invalide |
| `server` redémarre en boucle | `docker compose logs server` — souvent une env var manquante |
| Sims qui timeout | Augmenter `SIM_CONCURRENCY` ou passer sur VPS L |
| OOM pendant `docker build` | VPS sous-dimensionné — passer sur M minimum |
| Bot Discord muet | Vérifier `DISCORD_BOT_TOKEN` + intents activés sur le portal Discord |
