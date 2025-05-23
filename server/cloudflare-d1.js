// cloudflare-d1.js
// Helper to query Cloudflare D1 from Node.js (using HTTP API)
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();
const D1_URL = process.env.D1_URL;
const D1_API_KEY = process.env.D1_API_KEY;

const isTestEnv = process.env.NODE_ENV === 'test' || (process.argv[1] && process.argv[1].includes('jest'));
if (!isTestEnv) {
  if (!D1_URL) {
    throw new Error('Falta la variable de entorno D1_URL');
  }
  if (!D1_API_KEY) {
    throw new Error('Falta la variable de entorno D1_API_KEY');
  }
}

import app from './index.js';

export async function queryD1(sql, params = []) {
  if (isTestEnv && app.locals.db) {
    // Ejecuta sobre la base de datos SQLite en memoria
    try {
      const stmt = app.locals.db.prepare(sql);
      let result;
      if (sql.trim().toLowerCase().startsWith('select')) {
        result = stmt.all(...params);
        return { results: result };
      } else {
        result = stmt.run(...params);
        return { lastInsertRowid: result.lastInsertRowid };
      }
    } catch (e) {
      throw new Error('SQLite error: ' + e.message);
    }
  }
  // Si no es test, usa Cloudflare D1
  const res = await fetch(`${D1_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(D1_API_KEY && { 'Authorization': `Bearer ${D1_API_KEY}` }),
    },
    body: JSON.stringify({ sql, params }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`D1 error: ${err}`);
  }
  return res.json();
}

