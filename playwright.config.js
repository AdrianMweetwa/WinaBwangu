const { defineConfig } = require('@playwright/test');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const installedEdge = process.platform === 'win32' && [process.env['ProgramFiles(x86)'], process.env.ProgramFiles].filter(Boolean).some(root => existsSync(join(root, 'Microsoft/Edge/Application/msedge.exe')));
module.exports = defineConfig({
  testDir: './e2e', workers: 1, timeout: 30000,
  use: { browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || (installedEdge ? 'msedge' : undefined), headless: true, trace: 'retain-on-failure' },
});
