# WinaBwangu

WinaBwangu is our group web application for managing booths, financial services, and transactions.

## Technologies

- Node.js
- Express.js
- SQLite for local development
- PostgreSQL for hosted deployment
- better-sqlite3
- pg
- HTML
- CSS
- JavaScript

## Requirements

Install the following before running the project:

- Node.js 24.x (also recorded in `.nvmrc` and `package.json`)
- npm
- Git

The project runs with SQLite locally by default. For Render or other hosted environments, it also supports PostgreSQL via `DATABASE_URL`, which is the recommended option when the hosting plan does not provide a persistent disk.

## Clone the Project

```powershell
git clone https://github.com/AdrianMweetwa/WinaBwangu.git
cd WinaBwangu
```

## Install Dependencies

```powershell
npm ci
Copy-Item .env.example .env
```

The application loads `.env` automatically. On macOS/Linux use `cp .env.example .env`.
Keep `DATABASE_URL` unset to use local SQLite. No existing database is required.

## Initialize the Database

Local development still uses SQLite unless `DATABASE_URL` is set:

```powershell
npm run seed
```

The seed command creates the SQLite database, loads the six booths and five services, creates the three demo users, and loads the 308 Appendix 1 transactions. It only inserts missing transactions; existing records are never changed or deleted. Re-running it is safe.

Transactions are permanent after creation. The former reset command is disabled.
The API rejects PUT, PATCH and DELETE for transactions, and database triggers reject
updates, deletes and replacement of existing records (including cascading deletes).
Viewing, searching, filtering, exporting and printing remain available.

The `agent` role can have at most one booth; the form, API and database enforce this.
The `admin_agent` role can have multiple booths. System administrators automatically
see all booths, services and transactions without assignments. Switching an admin
agent to an agent requires choosing at most one booth.

Existing databases retain the first booth of any legacy multi-booth **agent**
assignment and record the original value in `assignment_migrations` for review.
Admin-agent assignments are preserved. Demo assignments are Wina1, Wina2 and Wina3
for `admin_agent`, and Wina4 for `agent`.

## Render / Hosted Deployment

The server is already configured to use the runtime port provided by the host:

```text
PORT=3000
```

For PostgreSQL deployments, set:

```text
DATABASE_URL=postgresql://user:password@host:5432/database_name
```

This is the recommended configuration for Render free/cheap plans because SQLite is file-based and needs a persistent disk. If a persistent disk is unavailable, use PostgreSQL instead.

## Start the Application

```powershell
npm start
```

Open the application in your browser:

```text
http://localhost:3000/login
```

The root URL (`http://localhost:3000/`) redirects unauthenticated users to the login page.

## Run the Tests

```powershell
npm test
```

The test suite covers password hashing, validation, role capabilities, the Appendix 1 transaction references, and the server-side 16% transaction calculation.

## Demo Accounts

All demo accounts use the password `password123`:

| Username | Role | Access |
|---|---|---|
| `admin` | System administrator | Full management access |
| `admin_agent` | Admin agent | View configuration and process transactions |
| `agent` | Agent | Process transactions for assigned booths and services |

The demo accounts are for local assignment testing only. Change or remove them before using the application in a real environment.

## Current Features

- Dashboard with revenue, capital, tax, service and booth summaries
- Booth and service management API
- Deposit and withdrawal transaction processing
- Server-side validation and 16% transaction tax calculation
- SQLite database with reproducible seed data
- API health check
- Secure session-based authentication
- Role-based access for system administrators, admin agents and agents
- Confirmation and success modals for CRUD operations
- Transaction search, filtering, pagination and receipt printing
- Logout and password recovery flow
- Modular CSS and JavaScript structure

## Submission Materials

The `submission/` directory contains our implementation report, formal test plan, and conceptual, use-case, and ER diagrams required by the assignment. Our reproducible Appendix 1 seed contains 308 sequential transactions. Use a fresh database and run `npm run seed` for the documented demonstration dataset.

## Project Structure

```text
WinaBwangu/
├── backend/
│   ├── auth/
│   ├── middleware/
│   ├── routes/
│   ├── utils/
│   ├── db.js
│   └── server.js
├── database/
│   ├── appendix-transactions.js
│   ├── schema.sql
│   └── seed.js
├── frontend/
│   ├── css/
│   │   └── modules/
│   ├── js/
│   │   └── modules/
│   ├── index.html
│   ├── login.html
│   └── forgot-password.html
├── submission/
│   ├── diagrams.md
│   ├── report.md
│   └── test-plan.md
├── test/
├── package.json
└── README.md
```

## Common Commands

```powershell
npm ci            # Install exact locked dependencies
npm run seed      # Initialize data without changing existing transactions
npm test          # Run automated tests
npm start         # Start the Express server
```

Additional automated checks:

```powershell
npm.cmd run test:browser   # Browser forms, search, confirmations, mobile navigation and printing
npm.cmd run test:postgres  # Disposable PostgreSQL: schema, seed, CRUD, sessions and API flows
npm.cmd run test:all       # Run all three suites
npm.cmd run verify:startup # Smoke-test npm start after seeding a fresh checkout
```

Run `npm ci` first to install the development tools. Browser tests use installed
Microsoft Edge on Windows when available; otherwise run `npx playwright install chromium`
once. Set `PLAYWRIGHT_CHANNEL` to select another installed browser channel. Browser
checks run headlessly and use a temporary SQLite database. Print checks verify the
print controls and receipt print styles; they do not interact with a physical printer.
Use `npm` instead of `npm.cmd` on macOS/Linux. On Windows, `npm.cmd` also works when
PowerShell's execution policy blocks `npm.ps1`.

PostgreSQL checks start an embedded PostgreSQL server on a temporary local port and
remove its temporary database afterward. They do not use your configured application
database. The first dependency installation downloads platform-specific PostgreSQL
binaries. For a local PostgreSQL application server without TLS, set `DATABASE_SSL=false`;
hosted connections retain the existing TLS behavior by default.

Press `Ctrl+C` in the terminal to stop the server.

## Before Real Use

After completing the fresh-install tests, replace the default demo passwords:

```powershell
npm.cmd run secure-demo
```

This SQLite command takes a verified backup, generates a separate random password
for each demo account still using `password123`, and invalidates their sessions
and reset tokens. Existing non-default passwords are preserved. The generated
passwords are saved under `.private/` with restricted access; they are not printed
or committed. Store them in your password manager. Each new installation needs
this step; generated credentials are deliberately not distributed through Git.
`verify:startup` uses the initial demo password, so run it before rotation.

Back up the local SQLite database manually or install the Windows daily task:

```powershell
npm.cmd run backup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install-backup-task.ps1
```

The task runs at 18:00 local time while the installing user is signed in, with a
missed run started when available. It uses SQLite's online backup API and verifies
the resulting database. Backups and `backups/daily.log` stay outside Git. Existing
backups are retained. Install the task again if the project or Node.js moves.
These are local recovery copies; keep a separate protected copy off the machine
for protection against disk loss. PostgreSQL installations need managed backups
or `pg_dump`; these two local maintenance commands intentionally reject them.

Before restoring, stop the app and preserve its current database. Verify a chosen
backup with SQLite `PRAGMA integrity_check`, then restore it to `DATABASE_PATH`
(default `database/winabwangu.db`). A restore also restores the passwords and
sessions from that backup, so review credentials afterward. Never restore over
a running application.


GitHub: https://github.com/AdrianMweetwa/WinaBwangu
