process.env.NODE_ENV = "test";
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let directory, db, server, base;
test.beforeAll(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-browser-'));
  process.env.DATABASE_PATH = path.join(directory, 'test.db');
  delete process.env.DATABASE_URL;
  execFileSync(process.execPath, [path.join(__dirname, '../database/seed.js')], { env: process.env });
  db = require('../backend/db');
  server = require('../backend/server').listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  if (db) db.close();
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
});
test.beforeEach(async ({ page }) => {
  db.exec('SAVEPOINT browser_case');
  // External fonts are cosmetic and must not make local checks depend on a CDN.
  await page.route(/https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//, route => route.abort());
  await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#login-identifier').fill('admin');
  await page.locator('#login-password').fill('password123');
  await page.locator('#login-form button[type=submit]').click();
  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(page.locator('#dash-active-booths')).toHaveText('6');
});
test.afterEach(() => db.exec('ROLLBACK TO browser_case; RELEASE browser_case'));
test('search finds records and opens transactions', async ({ page }) => {
  await page.locator('#global-search').fill('WB0000001');
  await page.locator('#global-search-results .search-result').click();
  await expect(page.locator('#transactions')).toBeVisible();
  await page.locator('#transaction-search').fill('WB0000001');
  await expect(page.locator('#transactions-tbody tr')).toHaveCount(1);
  await expect(page.locator('#transactions-tbody')).toContainText('WB0000001');
  await page.locator('#transaction-search').fill('no-such-record');
  await expect(page.locator('#transactions-tbody')).toContainText('No transactions found');
});
test('transactions remain view-only in the browser and reject direct writes', async ({ page }) => {
  await page.locator('nav [data-page=transactions]').click();
  await expect(page.locator('#overview-total-count')).toHaveText('308');
  await page.locator('#transaction-search').fill('WB0000001');
  await expect(page.locator('.edit-transaction-btn, .delete-transaction-btn, #transaction-edit-modal')).toHaveCount(0);
  await page.locator('.view-transaction-btn').click();
  await expect(page.locator('#receipt-transaction-id')).toHaveText('WB0000001');
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    const response = await page.request.fetch(base + '/api/transactions/WB0000001', { method, data: { transaction_amount: 1 } });
    expect(response.status()).toBe(405);
  }
});

test('user form selects one booth and saves a reassignment', async ({ page }) => {
  await page.locator('nav [data-page=users]').click();
  const row = page.locator('#users-tbody tr').filter({ has: page.getByRole('cell', { name: 'agent', exact: true }) });
  await row.locator('.edit-user-btn').click();
  await page.locator('input[name=user-booths][value=Wina1]').check();
  await page.locator('input[name=user-booths][value=Wina2]').check();
  await expect(page.locator('input[name=user-booths]:checked')).toHaveCount(1);
  await expect(page.locator('input[name=user-booths][value=Wina1]')).not.toBeChecked();
  await page.locator('#save-user').click();
  await page.locator('#confirm-crud-action').click();
  await expect(page.locator('#crud-success-title')).toHaveText('User Updated');
  expect(db.prepare("SELECT assigned_booths FROM users WHERE username = 'agent'").get().assigned_booths).toBe('Wina2');
});

test('mobile navigation opens, dismisses and closes after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#primary-navigation')).toHaveAttribute('aria-hidden', 'true');
  await page.locator('#sidebar-toggle').click();
  await expect(page.locator('#sidebar-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#sidebar-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#sidebar-toggle').click();
  await page.locator('nav [data-page=transactions]').click();
  await expect(page.locator('#transactions')).toBeVisible();
  await expect(page.locator('#primary-navigation')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#sidebar-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('admin-agent form allows multiple booths and system admins have automatic full access', async ({ page }) => {
  await page.locator('nav [data-page=users]').click();
  const row = page.locator('#users-tbody tr').filter({ has: page.getByRole('cell', { name: 'admin_agent', exact: true }) });
  await row.locator('.edit-user-btn').click();
  for (const input of await page.locator('input[name=user-booths]').all()) await input.uncheck();
  await page.locator('input[name=user-booths][value=Wina2]').check();
  await page.locator('input[name=user-booths][value=Wina5]').check();
  await expect(page.locator('input[name=user-booths]:checked')).toHaveCount(2);
  await page.locator('#save-user').click();
  await page.locator('#confirm-crud-action').click();
  await expect(page.locator('#crud-success-title')).toHaveText('User Updated');
  expect(db.prepare("SELECT assigned_booths FROM users WHERE username = 'admin_agent'").get().assigned_booths).toBe('Wina2,Wina5');
  await page.getByRole('button', { name: 'Close success modal', exact: true }).click();
  const admin = page.locator('#users-tbody tr').filter({ has: page.getByRole('cell', { name: 'admin', exact: true }) });
  await admin.locator('.edit-user-btn').click();
  await expect(page.locator('#user-booth-help')).toContainText('automatically see all booths and services');
  await expect(page.locator('input[name=user-booths]')).toHaveCount(0);
});
test('receipt and report print controls invoke printing and receipt print styles hide controls', async ({ page }) => {
  await page.evaluate(() => { window.print = () => { window.printCalls = (window.printCalls || 0) + 1; }; });
  await page.locator('nav [data-page=transactions]').click();
  await page.locator('#print-transactions').click();
  expect(await page.evaluate(() => window.printCalls)).toBe(1);
  await page.locator('.view-transaction-btn').first().click();
  await expect(page.locator('#receipt-transaction-id')).toContainText('WB');
  await page.locator('.receipt-print-btn').click();
  expect(await page.evaluate(() => window.printCalls)).toBe(2);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.receipt-print-btn')).toBeHidden();
  await expect(page.locator('#receipt-transaction-id')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('body')).not.toHaveClass(/printing-receipt/);
});
