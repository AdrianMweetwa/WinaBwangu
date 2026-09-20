# WinaBwangu

WinaBwangu is a web application for managing booths, financial services, and transactions.

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

**Adrian Mweetwa**

GitHub: https://github.com/AdrianMweetwa
