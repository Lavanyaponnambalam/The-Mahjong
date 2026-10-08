# 🀄 One Shot Mahjong

Chinese Mahjong in the browser. No accounts: you type a username, play, and try to beat your own **best score, best time and fewest moves**.

React + Vite + Tailwind (client) · Node + Express (server) · MySQL.

## Run it

```bash
npm run install:all
cp server/.env.example server/.env      # set DB_USER / DB_PASSWORD for your MySQL
npm run dev:server                      # creates the database + tables automatically (port 5000)
npm run dev:client                      # http://localhost:5173 (proxies /api to 5000)
```
Production: `npm run build && npm start` - Express serves `client/dist` on port 5000.
Tests: `npm test` (engine rules, scoring, 300 simulated full games).

## How it works

- **Identity** is a case-insensitive username (`Lavanya` = `lavanya`). The browser remembers which players used the device; all stats and history are in MySQL.
- **The server owns the game.** It shuffles the wall (crypto RNG), deals, runs the AI, validates every action, and computes time, moves, score and the winner. The client only sends intent (`discard tile 17`, `pong`, `win`). A fake win is rejected, and opponents' hands and the wall are never sent to the browser.
- **Timer:** starts when the game is created (stored `started_at`); a refresh restores the active game and the running clock. The final time is measured by the server.
- **Moves** (one definition everywhere): each of *your* Draw, Discard, Chow, Pong, Kong and Mahjong actions. Passing, menus and bonus-tile replacements don't count. Your draw is automatic but counted.
- **Records** (best score / time / moves) are set by **winning** games. Losses and draws still count in games played, history and average score.
- Tables: `players`, `games` (incl. active game state, so refresh/close-reopen works), `game_actions` (every draw/discard/claim, human and AI).

## Rules implemented
136 or 144 tiles (flowers/seasons replaced from the wall end) · dealer 14 / others 13 · Chow only from the player on your left · Pong from anyone · open, concealed and added Kong with replacement draw · win by self-draw or discard (4 sets + pair, Seven Pairs, Thirteen Orphans) · 14-tile dead wall · drawn game when the live wall is empty · priority Mahjong > Pong/Kong > Chow.

**Modes:** Solo (full table, Easy AI), 2, 3 or 4 seats (you + AI). Seats are generic, so human seats can be added later.

**Scoring** (`server/src/engine/scoring.js`, shown in-game): a simplified fan-style point system - base 30, self-draw, concealed hand, all chows/pongs, one-suit hands, dragons and winds, kongs, flowers, last tile, special hands. If you don't win, your score is hand progress (0-40).
**Not implemented:** robbing a Kong, the full MCR fan list, payments between players, multiple rounds / dealer rotation.

**AI:** Easy (partly random, hand heuristics), Normal (hand evaluation), Hard (shanten + tile efficiency + safety). Personalities: Master Chen (strategic), Lucky Panda (friendly, claims less), Tile Ninja (aggressive, claims more). AIs only use their own hand plus public discards/melds.

## Layout
```
server/src/engine   tiles, hand (win/shanten), scoring, ai, game (rules), view (what the player may see)
server/src/services players + games (persistence, records)    server/sql/schema.sql
client/src          pages (Welcome, Dashboard, Mode, Game, History), game/Table + Result
client/public/assets  your image pack (tile backgrounds made transparent, 2x upscaled)
```

## Deploying (Netlify + a backend host)

Netlify serves only the static client. The API (Express + MySQL) needs a Node host and a MySQL database.

1. **Database:** create a MySQL database on any provider (Railway, Aiven, etc.). Tables are created automatically on first boot.
2. **Backend** (Render / Railway / Fly): root directory `server`, build `npm install`, start `npm start`.
   Env vars: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true` (if required), `PORT` (usually set by the host).
   Check `https://<backend>/api/health` returns `{"ok":true}`.
3. **Netlify:** `netlify.toml` is included (base `client`, publish `dist`). Edit the `/api/*` redirect to point at your backend URL.
   The redirect makes the browser call same-origin `/api`, so no CORS setup is needed.

Simplest alternative: host everything on one Node service (`npm run build && npm start`) - Express serves the built client and the API together.
