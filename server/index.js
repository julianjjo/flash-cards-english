import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

dotenv.config();
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
const ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4000;
const isTestEnv = process.env.NODE_ENV === 'test' || (process.argv[1] && process.argv[1].includes('jest'));
const db = isTestEnv ? new Database(':memory:') : new Database('./server/flashcards.db');
app.locals.db = db;

app.use(cors());
app.use(express.json());
app.use('/audio', express.static(path.join(__dirname, 'audio')));

// Crear tabla si no existe (ahora con audio_url)
const createTable = `CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  en TEXT NOT NULL,
  es TEXT NOT NULL,
  level INTEGER DEFAULT 0,
  nextReview TEXT,
  audio_url TEXT
);`;
db.prepare(createTable).run();

// Agregar columna audio_url si falta
try {
  db.prepare('SELECT audio_url FROM cards LIMIT 1').get();
} catch (e) {
  db.prepare('ALTER TABLE cards ADD COLUMN audio_url TEXT').run();
}

// GET todas las tarjetas
app.get('/api/cards', (req, res) => {
  const cards = db.prepare('SELECT * FROM cards').all();
  res.json(cards);
});

// POST nueva tarjeta (genera audio)
app.post('/api/cards', async (req, res) => {
  const { en, es } = req.body;
  if (!en || !es) return res.status(400).send('Faltan campos');
  let audio_url = null;
  const isTest = process.env.NODE_ENV === 'test' || (process.argv[1] && process.argv[1].includes('jest'));
  if (!isTest) {
    try {
      // Llama a ElevenLabs
      const elevenRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: en,
            model_id: ELEVENLABS_MODEL_ID,
          }),
        }
      );
      if (!elevenRes.ok) {
        const apiError = await elevenRes.text();
        console.error('[ElevenLabs ERROR]', {
          status: elevenRes.status,
          statusText: elevenRes.statusText,
          response: apiError,
          text: en,
        });
        throw new Error('Error generando audio ElevenLabs');
      }
      const audioBuffer = Buffer.from(await elevenRes.arrayBuffer());
      // Asegura carpeta audio
      const audioDir = path.join(__dirname, 'audio');
      if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);
      // Guarda archivo
      const filename = `card_${Date.now()}.mp3`;
      const filePath = path.join(audioDir, filename);
      fs.writeFileSync(filePath, audioBuffer);
      audio_url = `/audio/${filename}`;
    } catch (err) {
      console.error('No se pudo generar audio:', err);
      audio_url = null;
    }
  }
  // Inicializa level=0 y nextReview=ahora
  const now = new Date().toISOString();
  const info = db.prepare('INSERT INTO cards (en, es, audio_url, level, nextReview) VALUES (?, ?, ?, ?, ?)').run(en, es, audio_url, 0, now);
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(card);
});

// PUT actualizar tarjeta
app.put('/api/cards/:id', async (req, res) => {
  const { en, es, level, nextReview } = req.body;
  const id = req.params.id;
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  if (!card) return res.status(404).send('Not found');

  let audio_url = card.audio_url;
  const isTest = process.env.NODE_ENV === 'test' || (process.argv[1] && process.argv[1].includes('jest'));
  // Si el campo 'en' cambia, regenerar audio (solo si no es test)
  if (en && en !== card.en && !isTest) {
    try {
      const elevenRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: en,
            model_id: ELEVENLABS_MODEL_ID,
          }),
        }
      );
      if (!elevenRes.ok) throw new Error('Error generando audio ElevenLabs');
      const audioBuffer = await elevenRes.arrayBuffer();
      const audioDir = path.join(__dirname, 'audio');
      if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);
      const filename = `card_${Date.now()}.mp3`;
      const filePath = path.join(audioDir, filename);
      fs.writeFileSync(filePath, Buffer.from(audioBuffer));
      audio_url = `/audio/${filename}`;
    } catch (err) {
      console.error('No se pudo regenerar audio:', err);
      audio_url = null;
    }
  } else if (en && en !== card.en && isTest) {
    audio_url = null;
  }

  db.prepare(`UPDATE cards SET 
    en = COALESCE(?, en),
    es = COALESCE(?, es),
    level = COALESCE(?, level),
    nextReview = COALESCE(?, nextReview),
    audio_url = ?
    WHERE id = ?
  `).run(en, es, level, nextReview, audio_url, id);
  const updated = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE tarjeta
app.delete('/api/cards/:id', (req, res) => {
  db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// GET cards próximas a repasar
app.get('/api/cards/next', (req, res) => {
  const now = new Date().toISOString();
  const cards = db.prepare('SELECT * FROM cards WHERE nextReview IS NOT NULL AND nextReview <= ? ORDER BY nextReview ASC').all(now);
  res.json(cards);
});

// POST marcar card como repasada y actualizar nextReview y level
app.post('/api/cards/:id/review', (req, res) => {
  const id = req.params.id;
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  if (!card) return res.status(404).send('Not found');
  // Intervalos: 1min, 30min, 1h, 6h, 1d, 3d, 7d, 14d, 30d
  const intervals = [
    1 * 60 * 1000,         // 1 min
    30 * 60 * 1000,        // 30 min
    60 * 60 * 1000,        // 1 hora
    6 * 60 * 60 * 1000,    // 6 horas
    24 * 60 * 60 * 1000,   // 1 día
    3 * 24 * 60 * 60 * 1000, // 3 días
    7 * 24 * 60 * 60 * 1000, // 7 días
    14 * 24 * 60 * 60 * 1000, // 14 días
    30 * 24 * 60 * 60 * 1000  // 30 días
  ];
  let nextLevel = (card.level || 0) + 1;
  if (nextLevel > 8) nextLevel = 8; // máximo 30 días
  const now = Date.now();
  const interval = intervals[nextLevel - 1] || intervals[intervals.length - 1];
  const nextReview = new Date(now + interval).toISOString();
  db.prepare('UPDATE cards SET level = ?, nextReview = ? WHERE id = ?').run(nextLevel, nextReview, id);
  const updated = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  res.json(updated);
});

// Servir archivos estáticos de React en producción
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientBuildPath));
  // Redirige cualquier ruta que no sea API a index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/audio')) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    }
  });
}

if (!isTestEnv) {
  app.listen(process.env.PORT || PORT, () => {
    console.log(`Server running on http://localhost:${process.env.PORT || PORT}`);
  });
}

export default app;