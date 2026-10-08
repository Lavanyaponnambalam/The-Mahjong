import { initDb } from './db.js';
await initDb();
console.log('Database ready.');
process.exit(0);
