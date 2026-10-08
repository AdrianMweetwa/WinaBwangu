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

- Node.js 18 or newer
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
npm install
```

## Set Up or Reset the Database

Local development still uses SQLite unless `DATABASE_URL` is set:

```powershell
npm run seed
```

The seed command creates the SQLite database, loads the six booths and five services, creates the three demo users, and loads the 308 Appendix 1 transactions. It replaces existing transaction rows, so run it when a clean assignment dataset is required.

The root `reset-db.js` utility is for hosted PostgreSQL databases only. It permanently clears the hosted schema and requires `DATABASE_URL`; do not run it for normal local SQLite setup.

```powershell
npm run reset-db
```

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

The `submission/` directory contains our implementation report, formal test plan, and conceptual, use-case, and ER diagrams required by the assignment. Our reproducible Appendix 1 seed contains 308 sequential transactions. Run `npm run seed` before the final demonstration so the local database matches the documented dataset.

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
npm install       # Install dependencies
npm run seed      # Create/reset the local database
npm run reset-db  # Destructively reset hosted PostgreSQL (DATABASE_URL required)
npm test          # Run automated tests
npm start         # Start the Express server
```

Press `Ctrl+C` in the terminal to stop the server.


GitHub: https://github.com/AdrianMweetwa/WinaBwangu
