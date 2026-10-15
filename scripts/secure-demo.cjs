const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const backup = require('./backup.cjs');
const { hashPassword, verifyPassword } = require('../backend/utils/password');

(async () => {
  // Take a verified recovery copy before migrations or account changes.
  await backup();
  const db = require('../backend/db');
  try {
    const users = db.prepare("SELECT id, username, password_hash FROM users WHERE username IN ('admin', 'admin_agent', 'agent')").all()
      .filter(user => verifyPassword('password123', user.password_hash));
    if (!users.length) { console.log('No demo accounts still use the default password.'); return; }
    const directory = path.resolve(__dirname, '../.private');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (process.platform === 'win32') {
      const identity = execFileSync('whoami', { encoding: 'utf8', windowsHide: true }).trim();
      execFileSync('icacls', [directory, '/inheritance:r', '/grant:r', `${identity}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'], { stdio: 'ignore', windowsHide: true });
    }
    const credentials = users.map(user => ({ username: user.username, password: randomBytes(24).toString('base64url') }));
    const filename = path.join(directory, `demo-credentials-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(filename, JSON.stringify(credentials, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    db.transaction(() => {
      for (const user of users) {
        const password = credentials.find(entry => entry.username === user.username).password;
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id);
        db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(user.id);
        db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
      }
    })();
    console.log(`Changed ${users.length} default passwords and invalidated their sessions/reset tokens.`);
    console.log(`Private credentials file: ${filename}`);
  } finally { await db.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
