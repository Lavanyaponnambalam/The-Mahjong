import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initDb } from './db.js';
import { api } from './routes/index.js';
import { HttpError } from './services/players.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors({ origin: config.clientOrigin.split(',') }));
app.use(express.json({ limit: '10kb' }));
app.use('/api', api);

// In production the built client can be served by this same process.
const dist = path.join(here, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.', code: 'SERVER_ERROR' });
});

await initDb();
app.listen(config.port, () => console.log(`Mahjong server on http://localhost:${config.port}`));
