# WinaBwangu

WinaBwangu is our group web application for managing booths, financial services, and transactions.

## Technologies

* Node.js
* Express.js
* SQLite
* better-sqlite3
* HTML
* CSS
* JavaScript

## Clone the Project

```powershell
git clone https://github.com/AdrianMweetwa/WinaBwangu.git
cd WinaBwangu
```

## Install Dependencies

```powershell
npm install
```

## Set Up the Database

```powershell
node database\seed.js
```

## Start the Application

```powershell
node backend\server.js or npm start
```

Open the application in your browser:

```text
http://localhost:3000
```

## Current Features

* Dashboard
* Booth management API
* Service management API
* Transaction API
* Deposit and Withdrawal transactions
* SQLite database
* API health check
* Secure session-based authentication
* Role-based access for system administrators, admin agents and agents
* Logout and password recovery flow

## Submission materials

The `submission/` directory contains our implementation report, formal test plan and conceptual, use-case and ER diagrams required by the assignment. Our reproducible Appendix 1 seed contains 308 sequential transactions. Run `node database\\seed.js` before the final demonstration so the local database matches the documented dataset.

## Project Structure

```text
WinaBwangu/
├── backend/
│   ├── db.js
│   ├── server.js
│   └── routes/
│       ├── booths.js
│       ├── services.js
│       └── transactions.js
│
├── database/
│   ├── schema.sql
│   ├── seed.js
│   └── winabwangu.db
│
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
│
└── README.md
```

## Author

**Group submission — add all group member names before submission**

GitHub: https://github.com/AdrianMweetwa
