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
import { hashPassword, verifyPassword, validatePasswordStrength } from './utils/passwordUtils.js';
import { generateToken } from './utils/jwtUtils.js';
import { authenticateToken, requireAdmin } from './middleware/auth.js';
import { 
  adminAuth, 
  adminUserManagement, 
  adminUserDeletion, 
  preventSelfAction,
  logAdminAction 
} from './middleware/adminAuth.js';

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

// Note: Authentication is now handled by JWT middleware on individual routes

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

// Servir archivos locales SOLO en test (por compatibilidad)
const isTest = process.env.NODE_ENV === 'test' || (process.argv[1] && process.argv[1].includes('jest'));
if (isTest) {
  app.use('/audio', express.static(path.join(__dirname, 'audio')));
}

// Initialize database and create tables
const isDev = process.env.NODE_ENV !== 'production' && !isTest;

(async () => {
  try {
    // Initialize database for development
    if (isDev) {
      // Import better-sqlite3 for development
      const { default: Database } = await import('better-sqlite3');
      const dbPath = path.join(__dirname, 'flashcards.db');
      app.locals.db = Database(dbPath);
      console.log('Development database initialized at:', dbPath);
    }
    // Create cards table
    await queryD1(`CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      en TEXT NOT NULL,
      es TEXT NOT NULL,
      level INTEGER DEFAULT 0,
      nextReview TEXT,
      audio_url TEXT,
      tips TEXT,
      easeFactor REAL DEFAULT 2.5,
      repetitions INTEGER DEFAULT 0,
      lastInterval INTEGER DEFAULT 0,
      user_id INTEGER
    );`);
    
    // Create users table
    await queryD1(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );`);
    
    // Add missing columns to existing tables
    await queryD1('ALTER TABLE cards ADD COLUMN easeFactor REAL DEFAULT 2.5;').catch(()=>{});
    await queryD1('ALTER TABLE cards ADD COLUMN repetitions INTEGER DEFAULT 0;').catch(()=>{});
    await queryD1('ALTER TABLE cards ADD COLUMN lastInterval INTEGER DEFAULT 0;').catch(()=>{});
    await queryD1('ALTER TABLE cards ADD COLUMN user_id INTEGER;').catch(()=>{});
    
  } catch (e) {
    console.error('Error creating tables:', e);
  }
})();

// Validation middleware
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateRegistration = (req, res, next) => {
  const { email, password } = req.body;
  const errors = {};

  if (!email) {
    errors.email = 'Email is required';
  } else if (!validateEmail(email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!password) {
    errors.password = 'Password is required';
  } else {
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.errors[0];
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = {};

  if (!email) {
    errors.email = 'Email is required';
  } else if (!validateEmail(email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

// ===== AUTHENTICATION ENDPOINTS =====

// POST /api/auth/register - Register new user
app.post('/api/auth/register', validateRegistration, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user already exists
    const existingUserResult = await queryD1('SELECT id FROM users WHERE email = ?', [email]);
    const existingUser = getFirstResult(existingUserResult);
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
        error: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert new user
    const insertResult = await queryD1(
      'INSERT INTO users (email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, 'user', new Date().toISOString(), new Date().toISOString()]
    );

    // Get the created user ID
    let userId;
    if (insertResult.result && insertResult.result[0] && insertResult.result[0].meta && insertResult.result[0].meta.last_row_id) {
      userId = insertResult.result[0].meta.last_row_id; // Cloudflare D1 via HTTP
    } else if (insertResult.meta && insertResult.meta.last_row_id) {
      userId = insertResult.meta.last_row_id; // Direct D1
    } else if (insertResult.lastInsertRowid) {
      userId = insertResult.lastInsertRowid; // Better-sqlite3
    } else {
      throw new Error('Failed to get user ID after insert');
    }

    // Fetch the complete user record
    const userResult = await queryD1('SELECT id, email, role, created_at, updated_at FROM users WHERE id = ?', [userId]);
    const user = getFirstResult(userResult);

    if (!user) {
      throw new Error('Failed to retrieve created user');
    }

    // Generate JWT token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: 'An error occurred during registration'
    });
  }
});

// POST /api/auth/login - Authenticate user
app.post('/api/auth/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const userResult = await queryD1('SELECT * FROM users WHERE email = ?', [email]);
    const user = getFirstResult(userResult);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        error: 'No account found with this email address'
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        error: 'Incorrect password'
      });
    }

    // Update last login time
    await queryD1('UPDATE users SET last_login = ? WHERE id = ?', [new Date().toISOString(), user.id]);

    // Generate JWT token
    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login: new Date().toISOString()
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: 'An error occurred during login'
    });
  }
});

// GET /api/auth/profile - Get current user profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch fresh user data from database
    const userResult = await queryD1('SELECT id, email, role, created_at, updated_at, last_login FROM users WHERE id = ?', [userId]);
    const user = getFirstResult(userResult);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'User account no longer exists'
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login: user.last_login
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: 'An error occurred while retrieving profile'
    });
  }
});

// PUT /api/auth/profile - Update user profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, currentPassword, newPassword } = req.body;
    const errors = {};

    // Validate email if provided
    if (email !== undefined) {
      if (!email) {
        errors.email = 'Email cannot be empty';
      } else if (!validateEmail(email)) {
        errors.email = 'Please enter a valid email address';
      }
    }

    // Validate password change if requested
    if (newPassword !== undefined) {
      if (!currentPassword) {
        errors.currentPassword = 'Current password is required to change password';
      }
      
      if (newPassword) {
        const passwordValidation = validatePasswordStrength(newPassword);
        if (!passwordValidation.isValid) {
          errors.newPassword = passwordValidation.errors[0];
        }
      } else {
        errors.newPassword = 'New password cannot be empty';
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Get current user data
    const userResult = await queryD1('SELECT * FROM users WHERE id = ?', [userId]);
    const user = getFirstResult(userResult);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password if password change is requested
    if (newPassword !== undefined && currentPassword) {
      const isValidPassword = await verifyPassword(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUserResult = await queryD1('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      const existingUser = getFirstResult(existingUserResult);
      
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists'
        });
      }
    }

    // Build update query
    const updates = [];
    const values = [];

    if (email && email !== user.email) {
      updates.push('email = ?');
      values.push(email);
    }

    if (newPassword) {
      const hashedPassword = await hashPassword(newPassword);
      updates.push('password = ?');
      values.push(hashedPassword);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(userId); // For WHERE clause

      const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      await queryD1(updateQuery, values);
    }

    // Fetch updated user data
    const updatedUserResult = await queryD1('SELECT id, email, role, created_at, updated_at, last_login FROM users WHERE id = ?', [userId]);
    const updatedUser = getFirstResult(updatedUserResult);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at,
        last_login: updatedUser.last_login
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Profile update failed',
      error: 'An error occurred while updating profile'
    });
  }
});

// DELETE /api/auth/profile - Delete user account
app.delete('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password confirmation is required',
        errors: {
          password: 'Password is required to delete account'
        }
      });
    }

    // Get current user data
    const userResult = await queryD1('SELECT * FROM users WHERE id = ?', [userId]);
    const user = getFirstResult(userResult);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password',
        error: 'Password verification failed'
      });
    }

    // Delete user's cards first (CASCADE)
    await queryD1('DELETE FROM cards WHERE user_id = ?', [userId]);

    // Delete user account
    await queryD1('DELETE FROM users WHERE id = ?', [userId]);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Account deletion failed',
      error: 'An error occurred while deleting account'
    });
  }
});

// ===== ADMIN ENDPOINTS =====

// GET /api/admin/users - Get all users (admin only)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    // Build search condition
    let whereCondition = '';
    let params = [];
    if (search) {
      whereCondition = 'WHERE email LIKE ?';
      params.push(`%${search}%`);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM users ${whereCondition}`;
    const countResult = await queryD1(countQuery, params);
    const total = getFirstResult(countResult)?.count || 0;

    // Get users with pagination
    const usersQuery = `
      SELECT id, email, role, created_at, updated_at, last_login 
      FROM users 
      ${whereCondition}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    
    const usersResult = await queryD1(usersQuery, params);
    const users = usersResult.results || usersResult.result?.[0]?.results || [];

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });

  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: 'An error occurred while retrieving users'
    });
  }
});

// GET /api/admin/users/:id - Get user by ID (admin only)
app.get('/api/admin/users/:id', adminUserManagement, async (req, res) => {
  try {
    const userId = req.targetUserId;

    const userResult = await queryD1('SELECT id, email, role, created_at, updated_at, last_login FROM users WHERE id = ?', [userId]);
    const user = getFirstResult(userResult);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'No user found with the provided ID'
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login: user.last_login
      }
    });

  } catch (error) {
    console.error('Admin user fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: 'An error occurred while retrieving user'
    });
  }
});

// PUT /api/admin/users/:id - Update user role (admin only)
app.put('/api/admin/users/:id', adminUserManagement, logAdminAction('UPDATE_USER_ROLE'), async (req, res) => {
  try {
    const userId = req.targetUserId;
    const { role } = req.body;

    // Validate role
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: {
          role: 'Role is required'
        }
      });
    }

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: {
          role: 'Role must be either "user" or "admin"'
        }
      });
    }

    // Check if user exists
    const userResult = await queryD1('SELECT * FROM users WHERE id = ?', [userId]);
    const user = getFirstResult(userResult);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'No user found with the provided ID'
      });
    }

    // Update user role
    await queryD1('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, new Date().toISOString(), userId]);

    // Fetch updated user
    const updatedUserResult = await queryD1('SELECT id, email, role, created_at, updated_at, last_login FROM users WHERE id = ?', [userId]);
    const updatedUser = getFirstResult(updatedUserResult);

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at,
        last_login: updatedUser.last_login
      }
    });

  } catch (error) {
    console.error('Admin user update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: 'An error occurred while updating user'
    });
  }
});

// DELETE /api/admin/users/:id - Delete user (admin only)
app.delete('/api/admin/users/:id', adminUserDeletion, logAdminAction('DELETE_USER'), async (req, res) => {
  try {
    const userId = req.targetUserId;

    // Check if user exists
    const userResult = await queryD1('SELECT * FROM users WHERE id = ?', [userId]);
    const user = getFirstResult(userResult);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'No user found with the provided ID'
      });
    }

    // Delete user's cards first (CASCADE)
    await queryD1('DELETE FROM cards WHERE user_id = ?', [userId]);

    // Delete user
    await queryD1('DELETE FROM users WHERE id = ?', [userId]);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Admin user deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: 'An error occurred while deleting user'
    });
  }
});

// GET todas las tarjetas (propias y compartidas)
app.get('/api/cards', authenticateToken, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const userId = req.user.id;
    // Get own cards and shared cards in a single query using UNION
    const result = await queryD1(`
      SELECT c.*, 'owner' as access_type, null as shared_permission FROM cards c WHERE c.user_id = ?
      UNION ALL
      SELECT c.*, 'shared' as access_type, cs.permission as shared_permission 
      FROM cards c 
      JOIN card_shares cs ON c.id = cs.card_id 
      WHERE cs.shared_with_user_id = ?
      ORDER BY id
    `, [userId, userId]);
    const data = result.results || result.result?.[0]?.results || [];
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

// POST nueva tarjeta (genera audio) - Requires authentication
app.post('/api/cards', upload.single('audio'), authenticateToken, async (req, res) => {
  const { en, es } = req.body;
  if (!en || !es) return res.status(400).send('Faltan campos');
  
  // Debug: Check user data
  console.log('User from token:', req.user);
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

    // Inicializa level=0 y nextReview=ahora, asociar con usuario autenticado
    const now = new Date().toISOString();
    const userId = req.user.id;
    const insertRes = await queryD1(
      'INSERT INTO cards (en, es, audio_url, level, nextReview, tips, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [en, es, audio_url, 0, now, tips, userId]
    );
    // D1 no retorna lastInsertRowid, así que buscamos la última tarjeta insertada por en, es, audio_url, nextReview, user_id
    const selectRes = await queryD1(
      'SELECT * FROM cards WHERE en = ? AND es = ? AND audio_url IS ? AND nextReview = ? AND user_id = ? ORDER BY id DESC LIMIT 1',
      [en, es, audio_url, now, userId]
    );
    const card = selectRes.results?.[0] || null;
    res.status(201).json(card);
  } catch (err) {
    console.error('Error creando tarjeta:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar tarjeta - requires write permission
app.put('/api/cards/:id', upload.single('audio'), authenticateToken, async (req, res) => {
  const { en, es, level, nextReview } = req.body;
  const id = req.params.id;
  const userId = req.user.id;
  
  try {
    const access = await checkCardAccess(id, userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Card not found' });
    }
    if (access.permission !== 'write') {
      return res.status(403).json({ error: 'Insufficient permissions to modify this card' });
    }
    const card = access.card;

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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE tarjeta - only owner can delete
app.delete('/api/cards/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await queryD1('DELETE FROM cards WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    
    // Check if any row was actually deleted
    if (result.changes === 0 || (result.result && result.result[0] && result.result[0].meta && result.result[0].meta.changes === 0)) {
      return res.status(404).json({ error: 'Card not found or not owned by user' });
    }
    
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET cards próximas a repasar - includes own and shared cards
app.get('/api/cards/next', authenticateToken, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const now = new Date().toISOString();
  const userId = req.user.id;
  try {
    const result = await queryD1(`
      SELECT c.*, 'owner' as access_type, null as shared_permission FROM cards c 
      WHERE c.nextReview IS NOT NULL AND c.nextReview <= ? AND c.user_id = ?
      UNION ALL
      SELECT c.*, 'shared' as access_type, cs.permission as shared_permission 
      FROM cards c 
      JOIN card_shares cs ON c.id = cs.card_id 
      WHERE c.nextReview IS NOT NULL AND c.nextReview <= ? AND cs.shared_with_user_id = ?
      ORDER BY nextReview ASC
    `, [now, userId, now, userId]);
    const data = result.results || result.result?.[0]?.results || [];
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST marcar card como repasada y actualizar nextReview y level (SM-2) - accessible cards with read permission
app.post('/api/cards/:id/review', authenticateToken, async (req, res) => {
  const id = req.params.id;
  const userId = req.user.id;
  // Permitir grade (0-5) por body o query, default 5
  let grade = 5;
  if (req.body && typeof req.body.grade !== 'undefined') grade = Number(req.body.grade);
  else if (req.query && typeof req.query.grade !== 'undefined') grade = Number(req.query.grade);
  if (isNaN(grade) || grade < 0 || grade > 5) grade = 5;
  try {
    const access = await checkCardAccess(id, userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Card not found' });
    }
    const card = access.card;
    // Only owners can modify spaced repetition data
    if (!access.isOwner) {
      return res.json({ message: 'Review recorded (shared card)', card });
    }
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

app.post('/api/cards/:id/regenerate-audio', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // Check card access and permissions
    const access = await checkCardAccess(id, userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Card not found' });
    }
    if (access.permission !== 'write') {
      return res.status(403).json({ error: 'Insufficient permissions to modify this card' });
    }
    const card = access.card;

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
app.post('/api/cards/:id/regenerate-tips', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    // Check card access and permissions
    const access = await checkCardAccess(id, userId);
    if (!access.hasAccess) {
      return res.status(404).json({ error: 'Card not found' });
    }
    if (access.permission !== 'write') {
      return res.status(403).json({ error: 'Insufficient permissions to modify this card' });
    }
    const card = access.card;
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

// Helper function to check if user can access a card and with what permissions
async function checkCardAccess(cardId, userId) {
  try {
    // First check if user owns the card
    const ownerResult = await queryD1('SELECT * FROM cards WHERE id = ? AND user_id = ?', [cardId, userId]);
    if (ownerResult.results?.length > 0 || getFirstResult(ownerResult)) {
      return { hasAccess: true, permission: 'write', isOwner: true, card: ownerResult.results?.[0] || getFirstResult(ownerResult) };
    }
    
    // Then check if card is shared with user
    const sharedResult = await queryD1(`
      SELECT c.*, cs.permission 
      FROM cards c 
      JOIN card_shares cs ON c.id = cs.card_id 
      WHERE c.id = ? AND cs.shared_with_user_id = ?
    `, [cardId, userId]);
    const sharedCard = sharedResult.results?.[0] || getFirstResult(sharedResult);
    if (sharedCard) {
      return { hasAccess: true, permission: sharedCard.permission, isOwner: false, card: sharedCard };
    }
    
    return { hasAccess: false, permission: null, isOwner: false, card: null };
  } catch (err) {
    throw new Error('Error checking card access: ' + err.message);
  }
}

// POST share a card with another user
app.post('/api/cards/:id/share', authenticateToken, async (req, res) => {
  const cardId = req.params.id;
  const userId = req.user.id;
  const { email, permission = 'read' } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  if (!['read', 'write'].includes(permission)) {
    return res.status(400).json({ error: 'Permission must be read or write' });
  }
  
  try {
    // Check if user owns the card
    const cardCheck = await queryD1('SELECT * FROM cards WHERE id = ? AND user_id = ?', [cardId, userId]);
    if (!cardCheck.results?.length && !getFirstResult(cardCheck)) {
      return res.status(404).json({ error: 'Card not found or not owned by you' });
    }
    
    // Find the user to share with
    const userResult = await queryD1('SELECT id FROM users WHERE email = ?', [email]);
    const targetUser = userResult.results?.[0] || getFirstResult(userResult);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (targetUser.id === userId) {
      return res.status(400).json({ error: 'Cannot share with yourself' });
    }
    
    // Create or update the share
    await queryD1(`
      INSERT OR REPLACE INTO card_shares (card_id, shared_by_user_id, shared_with_user_id, permission)
      VALUES (?, ?, ?, ?)
    `, [cardId, userId, targetUser.id, permission]);
    
    res.json({ message: 'Card shared successfully', email, permission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET shares for a card
app.get('/api/cards/:id/shares', authenticateToken, async (req, res) => {
  const cardId = req.params.id;
  const userId = req.user.id;
  
  try {
    // Check if user owns the card
    const cardCheck = await queryD1('SELECT * FROM cards WHERE id = ? AND user_id = ?', [cardId, userId]);
    if (!cardCheck.results?.length && !getFirstResult(cardCheck)) {
      return res.status(404).json({ error: 'Card not found or not owned by you' });
    }
    
    // Get all shares for this card
    const sharesResult = await queryD1(`
      SELECT cs.*, u.email 
      FROM card_shares cs 
      JOIN users u ON cs.shared_with_user_id = u.id 
      WHERE cs.card_id = ?
    `, [cardId]);
    
    const shares = sharesResult.results || sharesResult.result?.[0]?.results || [];
    res.json(shares);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE remove a share
app.delete('/api/cards/:id/shares/:shareId', authenticateToken, async (req, res) => {
  const cardId = req.params.id;
  const shareId = req.params.shareId;
  const userId = req.user.id;
  
  try {
    // Check if user owns the card
    const cardCheck = await queryD1('SELECT * FROM cards WHERE id = ? AND user_id = ?', [cardId, userId]);
    if (!cardCheck.results?.length && !getFirstResult(cardCheck)) {
      return res.status(404).json({ error: 'Card not found or not owned by you' });
    }
    
    // Remove the share
    await queryD1('DELETE FROM card_shares WHERE id = ? AND card_id = ?', [shareId, cardId]);
    res.json({ message: 'Share removed successfully' });
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
