# Verification — 13 October 2026

Implemented the final agreed rules:

- `agent`: at most one booth, enforced by the form, API validation and database triggers.
- `admin_agent`: multiple booths allowed; converting to `agent` requires reducing the assignment to at most one booth.
- `system_admin` (`admin`): all booths, services and transactions are visible without assignments.
- Transactions: creation and reading remain available; PUT, PATCH and DELETE return 405 for every authenticated role. Edit/delete controls and capabilities are removed. SQLite and PostgreSQL triggers reject updates, deletes and cascading deletion; SQLite replacement and PostgreSQL truncation are also blocked.
- Seeding inserts missing transactions without changing existing records. The destructive reset utility is disabled.
- Legacy multi-booth ordinary agents retain their first booth. Their previous assignment is saved in `assignment_migrations`. Admin-agent assignments are preserved.

Setup now documents Node.js 24.x, locked installation with `npm ci`, `.env.example`, automatic `.env` loading, database initialization and all test commands. Secrets, databases, test output, dependencies and verification directories are ignored by Git.

## Results

Verified on Windows with Node.js 24.21.0, npm 11.19.0 and headless Microsoft Edge. PostgreSQL tests launch an isolated embedded PostgreSQL instance.

| Check | Result |
|---|---|
| Actual GitHub clone at `245f7e844964553aabf1bb7a61940d3fa9fbeb5c` | Cloned successfully; its original installation, seed and 15 tests pass, but it has the old transaction/assignment behavior |
| Separate GitHub checkout with the updated source applied | No existing dependencies, application database or local `.env` copied from the developer checkout |
| Fresh `npm ci` in updated checkout | Passed; lockfile accepted; audit reported no vulnerabilities |
| Copy `.env.example` to `.env`, seed empty SQLite database | Passed; 308 sample transactions created |
| `npm run verify:startup` | Passed; starts through `npm start`, verifies authentication, frontend assets, catalog, users, transactions and rejected writes |
| `npm test` | 29 passed, 0 failed |
| `npm run test:browser` | 6 passed, 0 failed; includes single/multiple booth forms and default admin access |
| `npm run test:postgres` | Passed; initialization, seed, assignments, sessions, catalog CRUD, conflicts, rollback, transaction immutability, API flows and password reset |
| Migration, restart and repeated seed | Passed; legacy assignment repaired once, original assignment retained, records unchanged, database guards persist |
| `git diff --check` | Passed |

## Publication status

The implementation and maintenance additions were pushed successfully on 15 October 2026. A completely new clone was fetched directly from GitHub at `d8467dc`, without copying or modifying application source. `npm ci`, copying `.env.example` to `.env`, seeding an empty database, `npm run verify:startup` and `npm run test:all` all passed. Results: 29 backend/database tests, 6 browser tests, and the PostgreSQL checks. The checkout remained clean; no machine-local dependencies, credentials or database were copied into it. The published source is verified for this Windows/Node.js 24 setup. No testing on another operating system is claimed.

## Local maintenance — 15 October 2026

- Took a SQLite online backup and verified its integrity.
- Replaced all three local demo passwords with distinct random passwords; verified the generated credentials and rejection of `password123`.
- Invalidated the affected users' sessions and password-reset tokens. Credentials are stored only in the restricted, Git-ignored `.private/` directory.
- Registered `WinaBwanguBackup` for 18:00 local time while the current Windows user is signed in. Its initial run completed with result code 0 and produced a verified backup.
- Restored the post-rotation backup into a separate test database, verified its integrity and exact transaction preservation, then successfully authenticated all three accounts using the generated credentials.
- Added repeatable maintenance commands and documentation. New installations still require their own password rotation and backup setup.

Browser print tests verify controls and receipt print styles; they do not operate a physical printer.
