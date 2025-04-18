import request from 'supertest';
import app from './index.js';
import Database from 'better-sqlite3';

// Simula una base de datos en memoria para pruebas
beforeAll(() => {
  const db = new Database(':memory:');
  app.locals.db = db;
  db.prepare(`CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    en TEXT NOT NULL,
    es TEXT NOT NULL,
    level INTEGER DEFAULT 0,
    nextReview TEXT,
    audio_url TEXT
  );`).run();
});

afterAll(() => {
  if (app.locals.db) app.locals.db.close();
});

describe('Cards API', () => {
  let createdId;

  test('POST /api/cards crea una tarjeta', async () => {
    const res = await request(app)
      .post('/api/cards')
      .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS)
      .send({ en: 'test', es: 'prueba' });
    expect(res.statusCode).toBe(201);
    expect(res.body.en).toBe('test');
    expect(res.body.es).toBe('prueba');
    createdId = res.body.id;
  });

  test('GET /api/cards retorna tarjetas', async () => {
    const res = await request(app)
      .get('/api/cards')
      .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('PUT /api/cards/:id actualiza una tarjeta', async () => {
    const res = await request(app)
      .put(`/api/cards/${createdId}`)
      .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS)
      .send({ en: 'editado', es: 'editado', level: 1, nextReview: new Date().toISOString(), audio_url: null });
    expect(res.statusCode).toBe(200);
    expect(res.body.en).toBe('editado');
  });

  test('POST /api/cards/:id/review actualiza nextReview y level', async () => {
    const res = await request(app)
      .post(`/api/cards/${createdId}/review`)
      .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS)
      .send();
    expect(res.statusCode).toBe(200);
    expect(res.body.level).toBe(2); // porque ya lo subimos a 1 antes
    expect(new Date(res.body.nextReview)).toBeInstanceOf(Date);
  });
});
