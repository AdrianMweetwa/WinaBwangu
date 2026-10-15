import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
const probe = net.createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const directory = mkdtempSync(join(tmpdir(), 'wb-postgres-'));
const postgres = new EmbeddedPostgres({
  databaseDir: join(directory, 'data'), port, user: 'postgres', password: 'test-only',
  persistent: true, onLog: () => {}, onError: () => {},
  postgresFlags: ['-h', '127.0.0.1'],
});
let started = false;
try {
  await postgres.initialise();
  await postgres.start();
  started = true;
  await postgres.createDatabase('wb_test');
  const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: `postgresql://postgres:test-only@127.0.0.1:${port}/wb_test`, DATABASE_SSL: 'false' };
  for (const file of ['database/seed.js', 'scripts/postgres-check.cjs', 'scripts/postgres-api.cjs']) {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [file], { env, stdio: 'inherit', windowsHide: true });
      const timeout = setTimeout(() => child.kill(), 60000);
      child.once('error', reject);
      child.once('exit', code => { clearTimeout(timeout); resolve(code); });
    });
    if (code !== 0) throw new Error(`${file} failed (${code})`);
  }
} finally {
  if (started) await postgres.stop();
  rmSync(directory, { recursive: true, force: true });
}
