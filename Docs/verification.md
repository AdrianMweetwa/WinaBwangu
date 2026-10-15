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

The implementation was committed locally as `17ccc62` on 15 October 2026. Its source was compared with the previously tested clean checkout and matched. Publishing with `git push origin main` was attempted, but Git Credential Manager reported `User cancelled dialog`; Git could not obtain a GitHub username. The push did not succeed.

The published GitHub version therefore still contains the previous behavior. Complete GitHub authentication and run `git push origin main`, then verify a new remote clone. The local committed source passes the clean-install checks above, but the updated version is not yet published. No testing on another operating system is claimed.

Browser print tests verify controls and receipt print styles; they do not operate a physical printer.
