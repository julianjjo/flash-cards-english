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

export async function queryD1(sql, params = []) {
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
