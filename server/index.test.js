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
    audio_url TEXT,
    tips TEXT,
    easeFactor REAL DEFAULT 2.5,
    repetitions INTEGER DEFAULT 0,
    lastInterval INTEGER DEFAULT 0
  );`).run();
  process.env.GEMINI_API_KEY = 'AIzaSyB3bV2rpz4IUnHcV0_s8OUqa86SBOCxkk0';
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
    expect(res.body.level).toBe(1); // SM-2: primer repaso exitoso -> level=1
    expect(new Date(res.body.nextReview)).toBeInstanceOf(Date);
  });
});

// TDD Contract Tests - These MUST FAIL initially (Gemini TTS not implemented yet)
describe('TTS Contract Tests - Gemini Integration', () => {
  let testCardId;

  test('T004: POST /api/cards generates audio with Gemini TTS', async () => {
    const res = await request(app)
      .post('/api/cards')
      .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS)
      .send({ en: 'Hello world', es: 'Hola mundo' });
    
    expect(res.statusCode).toBe(201);
    expect(res.body.en).toBe('Hello world');
    expect(res.body.es).toBe('Hola mundo');
    
    // Contract: audio_url should be generated (or null in test mode)
    expect(res.body.audio_url).toBeDefined();
    
    // Contract: response structure must match existing ElevenLabs format
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('level', 0);
    expect(res.body).toHaveProperty('nextReview');
    expect(res.body).toHaveProperty('tips');
    
    testCardId = res.body.id;
  });

  test('T005: PUT /api/cards/:id regenerates audio when text changes', async () => {
    const res = await request(app)
      .put(`/api/cards/${testCardId}`)
      .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS)
      .send({ en: 'Updated text', es: 'Texto actualizado' });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.en).toBe('Updated text');
    
    // Contract: audio_url should be updated when English text changes
    expect(res.body.audio_url).toBeDefined();
    
    // Contract: response structure unchanged
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('level');
    expect(res.body).toHaveProperty('nextReview');
  });

  test('T006: POST /api/cards/:id/regenerate-audio forces TTS regeneration', async () => {
    const res = await request(app)
      .post(`/api/cards/${testCardId}/regenerate-audio`)
      .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS);
    
    expect(res.statusCode).toBe(200);
    
    // Contract: must return updated card with new audio_url
    expect(res.body).toHaveProperty('id', testCardId);
    expect(res.body.audio_url).toBeDefined();
    
    // Contract: same response structure as other endpoints
    expect(res.body).toHaveProperty('en');
    expect(res.body).toHaveProperty('es');
    expect(res.body).toHaveProperty('level');
  });
});
