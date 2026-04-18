# Riposte Guild Tool

Outil de gestion de guilde WoW pour **Riposte** (Hyjal-EU).

## Stack

- **Frontend** : React 18 + Vite + TypeScript + TailwindCSS
- **Backend** : Node.js + Express + TypeScript
- **Base de données** : PostgreSQL + Drizzle ORM
- **Real-time** : Socket.io
- **Bot Discord** : Discord.js v14

## Features

- Simulations (Quick Sim, Top Gear, Droptimizer, Gear Compare) via SimulationCraft
- Raid Planner avec cartes, phases, abilities, collaboration en temps réel
- Gestion des événements raid avec signups et Discord webhook
- Suivi de progression guild (WarcraftLogs, Raider.io)
- Profil personnage avec gear, enchants, M+ score
- Leaderboard guild (M+ et raid parses)
- Bot Discord (absences, candidatures, recap hebdo, slash commands)
- PWA installable avec service worker

## Setup

```bash
pnpm install
cp .env.example .env  # Configurer les variables
docker compose up -d  # PostgreSQL + Redis
pnpm db:migrate
pnpm dev
```

## Structure

```
packages/
  shared/       # Types et constantes partagés
  simc-engine/  # Parsers et builders SimC
  server/       # API Express + Discord bot
  web/          # Frontend React
```
