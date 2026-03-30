# Multiplayer Tic-Tac-Toe with Nakama

This project is a real-time multiplayer Tic-Tac-Toe game built with a server-authoritative architecture. The backend is powered by Nakama, and the frontend is built with React and Vite. Players can enter automatic matchmaking, create private game rooms, browse open rooms, compete in classic or timed matches, and play against each other in synchronized live sessions.

## Play Online

Click here to play: https://tic-tac-toe-nakama-nu.vercel.app/

## What This Project Does

- Supports real-time multiplayer Tic-Tac-Toe for two players
- Allows players to find games through automatic matchmaking
- Allows players to create and join game rooms manually
- Supports classic and timed game modes with server-enforced turn clocks
- Keeps all game rules and move validation on the server
- Broadcasts the latest match state to connected players
- Handles player disconnects by ending the match with a forfeit result
- Tracks persistent player stats and exposes a live leaderboard

## How It Was Built

The project uses Nakama authoritative matches to control the game state on the backend. Instead of trusting the client, the server owns the board, turn order, winner detection, draw detection, and disconnect handling. The React frontend connects to Nakama using the JavaScript client, joins matches through matchmaking or room flow, sends player moves, and renders the live board state received from the server.

The backend also exposes custom RPCs for room creation and leaderboard reads, uses Nakama matchmaker callbacks to create automatic matches for players searching for an opponent, and persists player performance data for rankings. On the frontend, the app manages session setup, socket connection, mode-aware lobby actions, room listing, room joining, gameplay updates, timed countdowns, leaderboard views, and replay flow.

## Architecture

### Backend

- Nakama authoritative match handler for Tic-Tac-Toe
- RPC endpoint to create a room-based match
- Matchmaker integration for auto-matching two players
- Matchmaker mode selection for classic vs. timed queues
- Server-side validation for legal moves and turn order
- Server-side result handling for wins, draws, and forfeits
- Persistent player stats and leaderboard updates after each match
- Authoritative timed-turn enforcement with timeout forfeits

### Frontend

- React single-page interface for lobby and gameplay
- Nakama socket connection for real-time communication
- Matchmaking flow for instant opponent search
- Room creation and room discovery flow
- Responsive board UI with live match status updates
- Lobby mode picker and leaderboard panel
- Timed-mode countdown display during matches

## Tech Stack

- Frontend: React, Vite, JavaScript
- Backend: Nakama server module
- Realtime client: `@heroiclabs/nakama-js`
- Database/runtime stack: PostgreSQL with Nakama
- Local/devops tooling: Docker, Docker Compose

## Project Structure

- `modules`: Nakama match logic and RPC implementation
- `tic-tac-toe-ui`: React frontend application
- `docker-compose.yml`: local Nakama and PostgreSQL setup
- `Dockerfile`: container build for the backend service

## Notes

This branch also includes bonus functionality beyond the core assignment requirements:

- Username/password login using Nakama email authentication with synthetic emails behind the scenes
- Persistent player stats stored in Nakama storage
- Global leaderboard powered by Nakama leaderboard records
- Classic and timed queues with mode-aware room discovery

## Key Design Choice

The most important design decision in this project is the server-authoritative model. All critical gameplay rules are enforced on the Nakama backend instead of the client. This keeps the match state consistent for both players and prevents invalid or out-of-turn moves from being accepted.
