<<<<<<< HEAD
# TIC_TAC_TOE_NAKAMA
A Complete tic tac toe game wiht online match making pool and game room options
=======
# Multiplayer Tic-Tac-Toe with Nakama

Server-authoritative multiplayer Tic-Tac-Toe built with Nakama for the backend and React + Vite for the frontend.

## Project Structure

- `modules`: Nakama authoritative match handler and RPCs.
- `tic-tac-toe-ui`: React client for matchmaking, room creation, room discovery, and gameplay.
- `docker-compose.yml`: Local development stack for Nakama + PostgreSQL.
- `Dockerfile`: Railway deployment image for Nakama that builds the server module during image creation.

## Mandatory Scope Status

- Server-authoritative game logic: complete
- Matchmaking and room flows: complete
- Cloud deployment: prepared for Railway (backend) and GitHub Pages (frontend)
- Deployment documentation: included below

## Local Development

### Backend

1. Build the Nakama module:

```bash
cd modules
npm install
npm run build
```

2. Start PostgreSQL and Nakama locally from the repo root:

```bash
docker compose up
```

Nakama will be available at `http://127.0.0.1:7350`.

### Frontend

1. Create a local environment file:

```bash
cd tic-tac-toe-ui
cp .env.example .env
```

2. Install dependencies and run the app:

```bash
npm install
npm run dev
```

## Frontend Environment Variables

The frontend reads Nakama configuration from Vite environment variables:

- `VITE_NAKAMA_SERVER_KEY`
- `VITE_NAKAMA_HOST`
- `VITE_NAKAMA_PORT`
- `VITE_NAKAMA_USE_SSL`

For local development, use the values from [`tic-tac-toe-ui/.env.example`](c:/Users/2025/tic-tac-toe-nakama/tic-tac-toe-ui/.env.example).

## Deployment Plan

### 1. Deploy Backend to Railway

1. Push this repository to GitHub.
2. In Railway, create a new project from the GitHub repo.
3. Add a PostgreSQL service in the same Railway project.
4. Add a variable on the Nakama service:

```text
DATABASE_ADDRESS=postgres:<PASSWORD>@<POSTGRES_HOST>:<POSTGRES_PORT>/railway
```

Use the actual PostgreSQL password, host, and port shown by Railway for your database service. The `Dockerfile` in the repo root will:

- install dependencies for `modules`
- compile the TypeScript Nakama module during image build
- run database migrations on startup
- start Nakama with the provided database connection

5. Expose the Nakama service publicly.
6. Copy the public Railway domain, for example `your-app.up.railway.app`.

Important:
- Railway should expose the Nakama HTTP/WebSocket endpoint over HTTPS.
- In the frontend, use `VITE_NAKAMA_USE_SSL=true` and port `443`.

### 2. Deploy Frontend to GitHub Pages

1. In GitHub, open repository `Settings -> Pages`.
2. Set source to `GitHub Actions`.
3. Add repository secrets:

- `VITE_NAKAMA_SERVER_KEY`
- `VITE_NAKAMA_HOST`
- `VITE_NAKAMA_PORT`
- `VITE_NAKAMA_USE_SSL`

Recommended production values:

```text
VITE_NAKAMA_SERVER_KEY=defaultkey
VITE_NAKAMA_HOST=<your-railway-domain>
VITE_NAKAMA_PORT=443
VITE_NAKAMA_USE_SSL=true
```

4. Push to `main` or manually run the `Deploy Frontend to GitHub Pages` workflow.
5. GitHub Pages will publish the Vite build from `tic-tac-toe-ui/dist`.

Because the Vite config uses a relative base path, the frontend works cleanly on a GitHub Pages project site.

## Submission Notes

- The backend is intended to be deployed shortly before submission/review and can be deleted after the interview evaluation window.
- The frontend can stay live on GitHub Pages at no cost.
- For an interview submission, include:
  - repository link
  - GitHub Pages URL
  - Railway backend URL
  - a short note that the backend demo deployment will remain available for a limited time

## Production Readiness Notes

- All move validation happens on the Nakama server.
- Room creation and room discovery are handled by authoritative Nakama matches.
- Match state is broadcast only from the backend after validation.
- If a player disconnects during an active game, the remaining player wins by forfeit.
>>>>>>> 52f1fdb (The Beginning)
