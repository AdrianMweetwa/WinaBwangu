const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
require('../backend/environment');
const root = path.resolve(__dirname, '..');

async function backup() {
  if (process.env.DATABASE_URL) throw new Error('This command backs up SQLite. Configure managed PostgreSQL backups or pg_dump for PostgreSQL.');
  const source = path.resolve(root, process.env.DATABASE_PATH || 'database/winabwangu.db');
  if (!fs.existsSync(source)) throw new Error('Database does not exist. Initialize it before backing up.');
  const folder = path.join(root, 'backups');
  fs.mkdirSync(folder, { recursive: true });
  const destination = path.join(folder, `winabwangu-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  const db = new Database(source, { readonly: true });
  try { await db.backup(destination); } finally { db.close(); }
  const copy = new Database(destination, { readonly: true });
  try {
    if (copy.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Backup integrity check failed');
  } finally { copy.close(); }
  console.log(`Verified SQLite backup: ${destination}`);
  return destination;
}
module.exports = backup;
if (require.main === module) backup().catch(error => { console.error(error.message); process.exitCode = 1; });
