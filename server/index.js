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
import { GoogleGenAI } from '@google/genai';
import { generateAudio } from './services/gemini-tts.js';

// Import route modules
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import flashcardRoutes from './routes/flashcards.js';
import studyRoutes from './routes/study.js';
import statsRoutes from './routes/stats.js';
import bulkRoutes from './routes/bulk.js';

const upload = multer({ storage: multer.memoryStorage() });

dotenv.config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

app.use(cors());
app.use(express.json());

// Connect route modules (before auth middleware)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/bulk', bulkRoutes);

// Legacy basic auth middleware for old /api/cards endpoints
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

// Servir archivos locales SOLO en test (por compatibilidad)
const isTest = process.env.NODE_ENV === 'test' || (process.argv[1] && process.argv[1].includes('jest'));
if (isTest) {
  app.use('/audio', express.static(path.join(__dirname, 'audio')));
}

// Database initialization moved to database.js migrations
// This immediate execution was causing circular dependency issues in tests

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

// Utilidad para extraer el primer resultado de queryD1, compatible con test y producción
function getFirstResult(res) {
  if (res.results) return res.results[0] || null; // test/local
  if (res.result && Array.isArray(res.result)) return res.result[0]?.results?.[0] || null; // prod/D1
  return null;
}

async function generateTipsWithGemini(en, es) {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const config = { responseMimeType: 'text/plain' };
  const model = 'gemini-2.5-flash-preview-04-17';
  const prompt = `Dame tips, sinónimos (en inglés), ejemplos y una curiosidad para aprender la palabra inglesa "${en}" (traducción: "${es}").\nDevuelve la respuesta en formato markdown, usando un bloque de código JSON así:\n\n\u0060\u0060\u0060json\n{\n  \"tips\": [\n    \"Ejemplo de tip 1\",\n    \"Ejemplo de tip 2\"\n  ],\n  \"sinonimos\": [\n    \"Synonym 1\",\n    \"Synonym 2\"\n  ],\n  \"ejemplos\": [\n    \"Frase de ejemplo en inglés (traducción corta al español).\"\n  ],\n  \"curiosidad\": \"Una curiosidad breve sobre la palabra.\"\n}\n\u0060\u0060\u0060\n\n- "tips": máximo 2 consejos prácticos, frases cortas.\n- "sinonimos": máximo 2 sinónimos o expresiones equivalentes en inglés.\n- "ejemplos": máximo 1 frase de ejemplo en inglés, con traducción corta al español.\n- "curiosidad": una sola curiosidad breve.\nNo uses explicaciones largas ni listas extensas.`;
  const contents = [
    {
      role: 'user',
      parts: [ { text: prompt } ],
    },
  ];
  let tips = '';
  try {
    const response = await ai.models.generateContentStream({ model, config, contents });
    for await (const chunk of response) {
      if (chunk.text) tips += chunk.text;
    }
  } catch (e) {
    throw new Error('Gemini SDK error: ' + e.message);
  }
  return tips;
}

// POST nueva tarjeta (genera audio)
app.post('/api/cards', upload.single('audio'), async (req, res) => {
  const { en, es } = req.body;
  if (!en || !es) return res.status(400).send('Faltan campos');
  let audio_url = null;
  let tips = null;

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
      // Si no hay archivo y no es test, generar con Gemini TTS y subir a R2
      const ttsResult = await generateAudio(en, 'en');
      if (!ttsResult.success) {
        console.error('[Gemini TTS ERROR]', { error: ttsResult.error });
        return res.status(500).json({ error: 'Error generando audio' });
      }
      
      audioBuffer = ttsResult.audioBuffer;
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: filename,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
      }));
      audio_url = `${R2_PUBLIC_URL}/${filename}`;
    }
    // Si es test, deja audio_url = null

    // Generar tips con Gemini
    if (!isTest) {
      try {
        tips = await generateTipsWithGemini(en, es);
        // Limpiar formato Markdown si Gemini responde con ```json ... ```
        if (typeof tips === 'string' && tips.trim().startsWith('```json')) {
          tips = tips.trim().replace(/^```json[\r\n]+/, '').replace(/```\s*$/, '').trim();
        }
        // Validar que sea JSON válido antes de guardar
        try {
          JSON.parse(tips);
        } catch {
          tips = null;
        }
      } catch (e) {
        console.error('Error generando tips con Gemini:', e);
        tips = null;
      }
    }

    // Inicializa level=0 y nextReview=ahora
    const now = new Date().toISOString();
    const insertRes = await queryD1(
      'INSERT INTO cards (en, es, audio_url, level, nextReview, tips) VALUES (?, ?, ?, ?, ?, ?)',
      [en, es, audio_url, 0, now, tips]
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
  const card = getFirstResult(selectRes);
  if (!card) return res.status(404).send('Not found');

  let audio_url = card.audio_url;
  // Si el campo 'en' cambia, regenerar audio (solo si no es test)
  if (en && en !== card.en && !isTest) {
    try {
      const ttsResult = await generateAudio(en, 'en');
      if (!ttsResult.success) {
        throw new Error(`Error generando audio: ${ttsResult.error}`);
      }
      
      const filename = `card_${Date.now()}.mp3`;
      // Subir a Cloudflare R2
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: filename,
        Body: ttsResult.audioBuffer,
        ContentType: 'audio/mpeg',
      }));
      audio_url = `${R2_PUBLIC_URL}/${filename}`;
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
  const updated = getFirstResult(updatedRes);
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

// POST marcar card como repasada y actualizar nextReview y level (SM-2)
app.post('/api/cards/:id/review', async (req, res) => {
  const id = req.params.id;
  // Permitir grade (0-5) por body o query, default 5
  let grade = 5;
  if (req.body && typeof req.body.grade !== 'undefined') grade = Number(req.body.grade);
  else if (req.query && typeof req.query.grade !== 'undefined') grade = Number(req.query.grade);
  if (isNaN(grade) || grade < 0 || grade > 5) grade = 5;
  try {
    const selectRes = await queryD1('SELECT * FROM cards WHERE id = ?', [id]);
    const card = selectRes.results?.[0] || null;
    if (!card) return res.status(404).send('Not found');
    // SM-2 variables
    let easeFactor = card.easeFactor || 2.5;
    let repetitions = card.repetitions || 0;
    let lastInterval = card.lastInterval || 0;
    let nextReview;
    if (grade < 3) {
      repetitions = 0;
      lastInterval = 1;
      nextReview = new Date(Date.now() + 24*60*60*1000).toISOString(); // 1 día
    } else {
      repetitions += 1;
      if (repetitions === 1) {
        lastInterval = 1;
      } else if (repetitions === 2) {
        lastInterval = 6;
      } else {
        lastInterval = Math.round(lastInterval * easeFactor);
      }
      nextReview = new Date(Date.now() + lastInterval * 24*60*60*1000).toISOString();
      // Actualizar easeFactor
      easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
      if (easeFactor < 1.3) easeFactor = 1.3;
    }
    // Opcional: actualizar level para compatibilidad visual
    let level = repetitions;
    await queryD1('UPDATE cards SET easeFactor = ?, repetitions = ?, lastInterval = ?, nextReview = ?, level = ? WHERE id = ?', [easeFactor, repetitions, lastInterval, nextReview, level, id]);
    const updatedRes = await queryD1('SELECT * FROM cards WHERE id = ?', [id]);
    const updated = updatedRes.results?.[0] || null;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cards/:id/regenerate-audio', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Recuperamos la tarjeta existente
    const selectRes = await queryD1('SELECT * FROM cards WHERE id = ?', [id]);
    const card = getFirstResult(selectRes);
    if (!card) {
      return res.status(404).send('Tarjeta no encontrada');
    }

    let audio_url = card.audio_url;

    if (!isTest) {
      // 3. Generamos el audio con Gemini TTS
      const ttsResult = await generateAudio(card.en, 'en');
      
      if (!ttsResult.success) {
        console.error('[Gemini TTS ERROR]', ttsResult.error);
        return res.status(502).json({ error: 'Error generando audio' });
      }

      const filename = `card_${Date.now()}.mp3`;

      // 4. Subimos el audio a R2
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: filename,
        Body: ttsResult.audioBuffer,
        ContentType: 'audio/mpeg',
      }));
      audio_url = `${R2_PUBLIC_URL}/${filename}`;
    } else {
      // En test, dejamos audio_url en null para no hacer llamadas externas
      audio_url = null;
    }

    // 5. Actualizamos la URL en la base de datos
    await queryD1(
      'UPDATE cards SET audio_url = ? WHERE id = ?',
      [audio_url, id]
    );

    // 6. Devolvemos la tarjeta actualizada
    const updatedRes = await queryD1('SELECT * FROM cards WHERE id = ?', [id]);
    const updatedCard = getFirstResult(updatedRes);
    return res.json(updatedCard);

  } catch (err) {
    console.error('Error regenerando audio:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Endpoint para regenerar tips de una card existente
app.post('/api/cards/:id/regenerate-tips', async (req, res) => {
  const { id } = req.params;
  try {
    const selectRes = await queryD1('SELECT * FROM cards WHERE id = ?', [id]);
    const card = getFirstResult(selectRes);
    if (!card) return res.status(404).send('Not found');
    let tips = null;
    try {
      tips = await generateTipsWithGemini(card.en, card.es);
      // Limpiar formato Markdown si Gemini responde con ```json ... ```
      if (typeof tips === 'string' && tips.trim().startsWith('```json')) {
        tips = tips.trim().replace(/^```json[\r\n]+/, '').replace(/```\s*$/, '').trim();
      }
      // Validar que sea JSON válido antes de guardar
      try {
        JSON.parse(tips);
      } catch {
        tips = null;
      }
    } catch (e) {
      console.error('Error generando tips con Gemini:', e);
      tips = null;
    }
    await queryD1('UPDATE cards SET tips = ? WHERE id = ?', [tips, id]);
    res.json({ tips });
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

export default app;
