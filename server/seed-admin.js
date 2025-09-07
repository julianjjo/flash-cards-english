import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'flashcards.db');
const db = Database(dbPath);

// Promote user ID 7 to admin role
const updateUserRole = db.prepare('UPDATE users SET role = ? WHERE id = ?');
const result = updateUserRole.run('admin', 7);

if (result.changes > 0) {
  console.log('✅ Successfully promoted user ID 7 to admin role');
  
  // Verify the change
  const getUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?');
  const user = getUser.get(7);
  console.log('User details:', user);
} else {
  console.log('❌ Failed to update user role - user not found');
}

db.close();