import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from './config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let pool;

/** Create the database and tables if they do not exist, then open the pool. */
export async function initDb() {
  const { database, ...conn } = config.db;
  const admin = await mysql.createConnection({ ...conn, multipleStatements: true });
  // Hosted databases often already exist and forbid CREATE DATABASE - that's fine.
  try { await admin.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); } catch (e) { console.warn('Skipping CREATE DATABASE:', e.code); }
  await admin.query(`USE \`${database}\``);
  await admin.query(fs.readFileSync(path.join(here, '../sql/schema.sql'), 'utf8'));
  await admin.end();
  pool = mysql.createPool({ ...config.db, waitForConnections: true, connectionLimit: 10, dateStrings: false, timezone: 'Z' });
  return pool;
}

export const db = () => pool;
