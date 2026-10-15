// Upgrade existing databases and enforce the same rules for direct SQL and API writes.
module.exports = function installIntegrity(db, postgres) {
  db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS assignment_migrations (
      user_id INTEGER PRIMARY KEY, previous_booths TEXT NOT NULL,
      retained_booth TEXT NOT NULL, migrated_at TEXT NOT NULL
    )`);
    for (const user of db.prepare("SELECT id, assigned_booths FROM users WHERE role = 'agent' AND assigned_booths LIKE '%,%'").all()) {
      const booth = user.assigned_booths.split(',').map(value => value.trim()).find(Boolean) || '';
      db.prepare('INSERT INTO assignment_migrations (user_id, previous_booths, retained_booth, migrated_at) VALUES (?, ?, ?, ?)').run(
        user.id, user.assigned_booths, booth, new Date().toISOString(),
      );
      db.prepare('UPDATE users SET assigned_booths = ? WHERE id = ?').run(booth, user.id);
    }
    if (postgres) {
      db.exec(`CREATE OR REPLACE FUNCTION wb_one_booth() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.role = 'agent' AND NEW.assigned_booths LIKE '%,%' THEN
            RAISE EXCEPTION 'Only one booth can be assigned to an agent' USING ERRCODE = '23514';
          END IF;
          RETURN NEW;
        END $$`);
      db.exec('DROP TRIGGER IF EXISTS users_one_booth ON users');
      db.exec('CREATE TRIGGER users_one_booth BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION wb_one_booth()');
      db.exec(`CREATE OR REPLACE FUNCTION wb_immutable_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Transactions cannot be edited or deleted' USING ERRCODE = '23514'; END $$`);
      db.exec('DROP TRIGGER IF EXISTS transactions_immutable ON transactions');
      db.exec('CREATE TRIGGER transactions_immutable BEFORE UPDATE OR DELETE ON transactions FOR EACH ROW EXECUTE FUNCTION wb_immutable_transaction()');
      db.exec('DROP TRIGGER IF EXISTS transactions_no_truncate ON transactions');
      db.exec('CREATE TRIGGER transactions_no_truncate BEFORE TRUNCATE ON transactions FOR EACH STATEMENT EXECUTE FUNCTION wb_immutable_transaction()');
    } else {
      db.exec(`
        DROP TRIGGER IF EXISTS users_one_booth_insert;
        DROP TRIGGER IF EXISTS users_one_booth_update;
        CREATE TRIGGER users_one_booth_insert BEFORE INSERT ON users
        WHEN NEW.role = 'agent' AND NEW.assigned_booths LIKE '%,%'
        BEGIN SELECT RAISE(ABORT, 'Only one booth can be assigned to an agent'); END;
        CREATE TRIGGER users_one_booth_update BEFORE UPDATE ON users
        WHEN NEW.role = 'agent' AND NEW.assigned_booths LIKE '%,%'
        BEGIN SELECT RAISE(ABORT, 'Only one booth can be assigned to an agent'); END;
        CREATE TRIGGER IF NOT EXISTS transactions_no_update BEFORE UPDATE ON transactions
        BEGIN SELECT RAISE(ABORT, 'Transactions cannot be edited or deleted'); END;
        CREATE TRIGGER IF NOT EXISTS transactions_no_delete BEFORE DELETE ON transactions
        BEGIN SELECT RAISE(ABORT, 'Transactions cannot be edited or deleted'); END;
        CREATE TRIGGER IF NOT EXISTS transactions_no_replace BEFORE INSERT ON transactions
        WHEN EXISTS (SELECT 1 FROM transactions WHERE id = NEW.id OR transaction_id = NEW.transaction_id)
        BEGIN SELECT RAISE(ABORT, 'Existing transactions cannot be replaced'); END;
      `);
    }
  })();
};
