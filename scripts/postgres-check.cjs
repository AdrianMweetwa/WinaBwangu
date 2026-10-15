const assert = require('node:assert/strict');
const db = require('../backend/db');
const { nextTransactionId } = require('../backend/utils/transaction-rules');
const { createSession, getUserForSession, deleteSession } = require('../backend/auth/session');
try {
  assert.equal(Number(db.prepare('SELECT COUNT(*) AS count FROM transactions').get().count), 308);
  assert.equal(nextTransactionId(db), 'WB0000309');
  assert.equal(db.prepare("SELECT assigned_booths FROM users WHERE username = 'admin_agent'").get().assigned_booths, 'Wina1,Wina2,Wina3');
  assert.throws(() => db.exec("UPDATE users SET role = 'agent' WHERE username = 'admin_agent'"), /one booth/i);
  for (const sql of [
    'DELETE FROM transactions', 'UPDATE transactions SET transaction_amount = 1',
    'TRUNCATE transactions', 'DELETE FROM booths WHERE id = 1',
    'DELETE FROM services WHERE id = 1',
    "UPDATE users SET assigned_booths = 'Wina1,Wina2' WHERE username = 'agent'",
  ]) assert.throws(() => db.exec(sql), /cannot be edited or deleted|one booth|foreign key/i);
  const services = db.prepare(`SELECT s.service FROM booth_services bs JOIN booths b ON b.id = bs.booth_id
    JOIN services s ON s.id = bs.service_id WHERE b.booth = ? ORDER BY s.id`).all('Wina4');
  assert.deepEqual(services.map(row => row.service), ['Airtel Money', 'MTN Money', 'Zamtel Money']);
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  const session = createSession(user.id);
  assert.equal(getUserForSession(session.token).username, 'admin');
  deleteSession(session.token);
  assert.equal(getUserForSession(session.token), null);
  const insert = db.prepare('INSERT INTO booths (booth, location) VALUES (?, ?)');
  const created = insert.run('TestBooth', 'Test');
  assert.ok(created.lastInsertRowid);
  assert.throws(() => insert.run('TestBooth', 'Duplicate'), /unique/i);
  assert.equal(db.prepare('INSERT OR IGNORE INTO booths (booth, location) VALUES (?, ?)').run('TestBooth', 'Duplicate').changes, 0);
  db.prepare('UPDATE booths SET location = ? WHERE id = ?').run('Updated', created.lastInsertRowid);
  assert.equal(db.prepare('SELECT location FROM booths WHERE id = ?').get(created.lastInsertRowid).location, 'Updated');
  assert.throws(() => db.transaction(() => { insert.run('RolledBack', 'Test'); throw new Error('rollback'); })(), /rollback/);
  assert.equal(db.prepare('SELECT id FROM booths WHERE booth = ?').get('RolledBack'), null);
  db.prepare('DELETE FROM booths WHERE id = ?').run(created.lastInsertRowid);
  assert.equal(db.prepare('SELECT id FROM booths WHERE id = ?').get(created.lastInsertRowid), null);
  console.log('PostgreSQL checks passed: schema, seed, IDs, assignments, sessions, CRUD, conflicts and rollback.');
} finally { db.close(); }
