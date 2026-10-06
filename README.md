# WinaBwangu

WinaBwangu is our group web application for managing booths, financial services, and transactions.

## Technologies

- Node.js
- Express.js
- SQLite
- better-sqlite3
- HTML
- CSS
- JavaScript

## Requirements

Install the following before running the project:

- Node.js 18 or newer
- npm
- Git

The project uses SQLite through `better-sqlite3`; no separate database server is required.

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

```powershell
npm run seed
```

The seed command creates the SQLite database, loads the six booths and five services, creates the three demo users, and loads the 308 Appendix 1 transactions. It replaces existing transaction rows, so run it when a clean assignment dataset is required.

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
npm test          # Run automated tests
npm start         # Start the Express server
```

Press `Ctrl+C` in the terminal to stop the server.


GitHub: https://github.com/AdrianMweetwa/WinaBwangu
