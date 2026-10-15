process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const Database = require('better-sqlite3');

test('legacy assignments migrate once, guards survive restart, and repeated seeding preserves transactions', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-migration-'));
  const filename = path.join(directory, 'legacy.db');
  const env = { ...process.env, DATABASE_PATH: filename, DATABASE_URL: '', NODE_ENV: 'test' };
  let db;
  try {
    db = new Database(filename);
    db.exec(fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8'));
    db.prepare(`INSERT INTO users (username, full_name, email, password_hash, role, assigned_booths)
      VALUES ('legacy', 'Legacy Agent', 'legacy@example.com', 'unused', 'agent', 'Wina2,Wina3')`).run();
    db.close(); db = null;
    const seed = () => execFileSync(process.execPath, [path.join(__dirname, '../database/seed.js')], { env, stdio: 'pipe' });
    seed();
    db = new Database(filename);
    assert.equal(db.prepare("SELECT assigned_booths FROM users WHERE username = 'legacy'").get().assigned_booths, 'Wina2');
    assert.equal(db.prepare('SELECT previous_booths FROM assignment_migrations').get().previous_booths, 'Wina2,Wina3');
    assert.equal(db.prepare("SELECT assigned_booths FROM users WHERE username = 'admin_agent'").get().assigned_booths, 'Wina1,Wina2,Wina3');
    const before = db.prepare('SELECT * FROM transactions ORDER BY id').all();
    db.close(); db = null;
    seed();
    execFileSync(process.execPath, ['-e', "require('./backend/db').close()"], { cwd: path.join(__dirname, '..'), env });
    db = new Database(filename);
    assert.deepEqual(db.prepare('SELECT * FROM transactions ORDER BY id').all(), before);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM assignment_migrations').get().count, 1);
    assert.throws(() => db.exec('DELETE FROM transactions'), /cannot be edited or deleted/);
    assert.throws(() => db.exec('UPDATE transactions SET transaction_amount = 1'), /cannot be edited or deleted/);
    assert.throws(() => db.exec("UPDATE users SET assigned_booths = 'Wina1,Wina2'"), /one booth/);
  } finally {
    if (db) db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
