import express from 'express';
import cors from 'cors';
import { queryD1 } from './cloudflare-d1.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

dotenv.config();
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
const ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';

// Cloudflare R2 config
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // e.g. https://<accountid>.r2.cloudflarestorage.com/<bucket>

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4000;

// Middleware de autenticación básica para admin
function adminAuth(req, res, next) {
  // Solo proteger rutas /api/cards y /audio
  if (!req.path.startsWith('/api/cards') && !req.path.startsWith('/audio')) return next();
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Auth required');
  }
  const b64 = auth.split(' ')[1];
  const [user, pass] = Buffer.from(b64, 'base64').toString().split(':');
  if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
  return res.status(401).send('Invalid credentials');
}
app.use(adminAuth);

app.use(cors());
app.use(express.json());

// Endpoint para servir audios desde R2
app.get('/audio/:filename', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { filename } = req.params;
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: filename,
    });
    const data = await s3Client.send(command);
    res.set('Content-Type', 'audio/mpeg');
    // Cloudflare R2 SDK: data.Body es un stream
    data.Body.pipe(res);
  } catch (err) {
    console.error('Error al obtener el archivo:', err);
    res.status(404).send('Audio no encontrado');
  }
});

app.use('/audio', express.static(path.join(__dirname, 'audio')));

// Crear tabla si no existe (ahora con audio_url)
// Cloudflare D1: crea la tabla si no existe
(async () => {
  try {
    await queryD1(`CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      en TEXT NOT NULL,
      es TEXT NOT NULL,
      level INTEGER DEFAULT 0,
      nextReview TEXT,
      audio_url TEXT
    );`);
  } catch (e) {
    console.error('Error creando tabla en D1:', e);
  }
})();

// GET todas las tarjetas
app.get('/api/cards', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const result = await queryD1('SELECT * FROM cards');
    const data = result.result?.[0]?.results || [];
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST nueva tarjeta (genera audio)
app.post('/api/cards', upload.single('audio'), async (req, res) => {
  const { en, es } = req.body;
  if (!en || !es) return res.status(400).send('Faltan campos');
  let audio_url = null;
  const isTest = process.env.NODE_ENV === 'test' || (process.argv[1] && process.argv[1].includes('jest'));

  try {
    let audioBuffer = null;
    let filename = `card_${Date.now()}.mp3`;
    if (req.file) {
      // Si el usuario subió un audio, usarlo y subirlo a R2
      audioBuffer = req.file.buffer;
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: filename,
        Body: audioBuffer,
        ContentType: req.file.mimetype || 'audio/mpeg',
      }));
      audio_url = `${R2_PUBLIC_URL}/${filename}`;
    } else if (!isTest) {
      // Si no hay archivo y no es test, generar con ElevenLabs y subir a R2
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
        console.error('[ElevenLabs ERROR]', { apiError });
        return res.status(500).json({ error: 'Error generando audio' });
      }
      audioBuffer = Buffer.from(await elevenRes.arrayBuffer());
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: filename,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
      }));
      audio_url = `${R2_PUBLIC_URL}/${filename}`;
    }
    // Si es test, deja audio_url = null

    // Inicializa level=0 y nextReview=ahora
    const now = new Date().toISOString();
    const insertRes = await queryD1(
      'INSERT INTO cards (en, es, audio_url, level, nextReview) VALUES (?, ?, ?, ?, ?)',
      [en, es, audio_url, 0, now]
    );
    // D1 no retorna lastInsertRowid, así que buscamos la última tarjeta insertada por en, es, audio_url, nextReview
    const selectRes = await queryD1(
      'SELECT * FROM cards WHERE en = ? AND es = ? AND audio_url IS ? AND nextReview = ? ORDER BY id DESC LIMIT 1',
      [en, es, audio_url, now]
    );
    const card = selectRes.results?.[0] || null;
    res.status(201).json(card);
  } catch (err) {
    console.error('Error creando tarjeta:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar tarjeta
app.put('/api/cards/:id', upload.single('audio'), async (req, res) => {
  const { en, es, level, nextReview } = req.body;
  const id = req.params.id;
  const selectRes = await queryD1('SELECT * FROM cards WHERE id = ?', [id]);
  const card = selectRes.results?.[0] || null;
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

  await queryD1(`UPDATE cards SET 
    en = COALESCE(?, en),
    es = COALESCE(?, es),
    level = COALESCE(?, level),
    nextReview = COALESCE(?, nextReview),
    audio_url = ?
    WHERE id = ?
  `, [en, es, level, nextReview, audio_url, id]);
  const updatedRes = await queryD1('SELECT * FROM cards WHERE id = ?', [id]);
  const updated = updatedRes.results?.[0] || null;
  res.json(updated);
});

// DELETE tarjeta
app.delete('/api/cards/:id', async (req, res) => {
  try {
    await queryD1('DELETE FROM cards WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET cards próximas a repasar
app.get('/api/cards/next', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const now = new Date().toISOString();
  try {
    const result = await queryD1('SELECT * FROM cards WHERE nextReview IS NOT NULL AND nextReview <= ? ORDER BY nextReview ASC', [now]);
    const data = result.result?.[0]?.results || [];
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST marcar card como repasada y actualizar nextReview y level
app.post('/api/cards/:id/review', async (req, res) => {
  const id = req.params.id;
  try {
    const selectRes = await queryD1('SELECT * FROM cards WHERE id = ?', [id]);
    const card = selectRes.results?.[0] || null;
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
    await queryD1('UPDATE cards SET level = ?, nextReview = ? WHERE id = ?', [nextLevel, nextReview, id]);
    const updatedRes = await queryD1('SELECT * FROM cards WHERE id = ?', [id]);
    const updated = updatedRes.results?.[0] || null;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Servir archivos estáticos de React en producción
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientBuildPath));
  // Redirige cualquier ruta que no sea API a index.html
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!req.path.startsWith('/api') && !req.path.startsWith('/audio')) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    }
  });
}

app.listen(process.env.PORT || PORT, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || PORT}`);
});

export default app;