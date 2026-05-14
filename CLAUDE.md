# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

ChitChat is a real-time messaging app with two independently runnable services:

- **`backend/`** — Node.js + Express + Socket.io, connecting to MySQL via Sequelize
- **`frontend/`** — React 19 + React Router v7, built with Vite

Both services are orchestrated via `docker-compose.yml` at the repo root.

## Running the Project

### With Docker (recommended)

```bash
docker compose up
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001
- MySQL: localhost:3307

### Without Docker

Start MySQL first (Docker-mapped port 3307 is assumed when `DB_HOST=localhost`), then:

```bash
# Backend
cd backend
npm install
npm run dev        # nodemon, hot-reloading

# Frontend (separate terminal)
cd frontend
npm install
npm run dev        # Vite dev server on port 3000
```

```bash
# Frontend lint
cd frontend && npm run lint

# Frontend production build
cd frontend && npm run build
```

## Backend Architecture

The backend has two layers of model files — don't confuse them:

- **`backend/models/*.js`** — Sequelize model factories (called by Sequelize with `(sequelize, DataTypes)`). These define the DB schema.
- **`backend/src/models/*.js`** — Higher-level data-access objects with named query methods (`findAll`, `findByEmail`, `findConversation`, etc.). These are what controllers import.
- **`backend/src/config/db.js`** — Loads all Sequelize model factories from `backend/models/`, runs associations, and exports the `db` object.

### Database Migrations

There are no manual migration commands. On every server start, `server.js` calls `migrate()` which runs `sequelize.sync({ alter: true })` — Sequelize automatically alters the schema to match the models.

### API Routes

| Route | File |
|-------|------|
| `POST /api/auth/login` | `src/routes/auth.js` |
| `GET/POST/PUT/DELETE /api/users` | `src/routes/users.js` |
| `GET /api/messages/*` | `src/routes/messages.js` |
| `GET /health` | `server.js` |

### Real-time (Socket.io)

Socket event handlers live in `backend/src/socket/chatHandler.js`. Online presence uses an in-memory `Map` (`userConnections`) keyed by `userId` — this does not survive restarts and won't work across multiple backend instances.

Socket events (client → server): `registerUser`, `sendMessage`, `markAsRead`, `userTyping`, `userStoppedTyping`

Socket events (server → client): `receiveMessage`, `messageSent`, `messageRead`, `userOnline`, `userOffline`, `userTyping`, `userStoppedTyping`

### Auth

Login (`POST /api/auth/login`) returns a plain user object — there is no JWT or session token. The frontend must store the returned user data itself (e.g., `localStorage`). No auth middleware currently protects any routes.

## Frontend Architecture

Pages: `Login`, `Signup`, `Home` (in `src/pages/`). Routing is in `src/App.jsx`. The `Home` page currently uses hardcoded placeholder data — real user/message fetching and Socket.io integration are not yet wired up.

The Vite dev server proxies nothing by default; the frontend must use `VITE_API_URL` (set to `http://localhost:5001` in Docker) to reach the backend.

## Environment Variables

Backend reads from `.env` (via `dotenv`):

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `5000` | Internal port |
| `DB_HOST` | `localhost` | Use `db` inside Docker |
| `DB_PORT` | `3307` (local) / `3306` (Docker) | Auto-detected in `db.js` |
| `DB_USER` | `root` | |
| `DB_PASSWORD` | `chitchat123` | |
| `DB_NAME` | `chitchat` | |
| `CORS_ORIGINS` | `http://localhost,http://localhost:5173` | Comma-separated |
