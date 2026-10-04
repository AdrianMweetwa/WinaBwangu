-- create the booth tables
-- each booth represents one winaBwangu location and has a unique id, name, and code
CREATE TABLE IF NOT EXISTS booths(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT NOT NULL,
    booth TEXT NOT NULL UNIQUE
);

-- create services tables
-- each service has a monthly transaction limit, a revenue rate, and a unique id and name
-- monthly transaction limit and revenue rate are stored in the services table, so they are not duplicated here
CREATE TABLE IF NOT EXISTS services(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service TEXT NOT NULL UNIQUE,
    monthly_transaction_limit REAL NOT NULL,
    revenue_rate REAL NOT NULL,
    identifier_type TEXT NOT NULL DEFAULT 'phone' -- 'phone' or 'account': which field a transaction for this service collects
);

-- create booth services table
--this links booths and services together, allowing for a many-to-many relationship between them
CREATE TABLE IF NOT EXISTS booth_services(
    booth_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    PRIMARY KEY (booth_id, service_id),
    FOREIGN KEY (booth_id) REFERENCES booths(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- create a transaction table
-- this table stores the details of transactions made at each booth for each service
CREATE TABLE IF NOT EXISTS transactions(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT NOT NULL UNIQUE,
    transaction_type TEXT NOT NULL,
    transaction_amount REAL NOT NULL,
    transaction_tax REAL NOT NULL,
    transaction_amount_after_tax REAL NOT NULL,
    transaction_revenue REAL NOT NULL,
    phone_number TEXT NOT NULL,
    account_number TEXT NOT NULL,
    booth_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    transaction_date TEXT NOT NULL,
    FOREIGN KEY (booth_id) REFERENCES booths(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- creating a users table to store user information
-- assigned_booths / assigned_services are stored as comma-separated codes/names
-- (e.g. "Wina1,Wina2") rather than join tables, since a user's access list is
-- edited as a whole from the Users form rather than queried relationally
CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL, -- 'system_admin' | 'admin_agent' | 'agent'
    company TEXT,
    assigned_booths TEXT NOT NULL DEFAULT '',
    assigned_services TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
    last_login TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);