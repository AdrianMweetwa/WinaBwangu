// import SQLite library used to connect to the database
const Database = require('better-sqlite3');
//import Node.js path module to handle file paths
const path = require('path');
// import Node.js fs module to handle file system operations
const fs = require("fs");

//Build the absolute path to the database file using the path module
// The database file is located in the "database" directory, one level up from the current directory
// The __dirname variable represents the directory of the current module (server.js)
// The path.join() method is used to concatenate the directory names and create a valid file path for the database file
const databasePath = path.join(__dirname, "..", "database", 'winabwangu.db');

// Open the Winabwangu database using the better-sqlite3 library
// SQLite will create the database file if it does not exist, and it will be opened in read/write mode 
const db = new Database(databasePath);
// Enable foreign key constraints in SQLite to ensure referential integrity between related tables
db.pragma("foreign_keys = ON");

// Load and run the database schema.
const schemaPath = path.join(__dirname, "..", "database", "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

// Execute the SQL statements in the schema file to create the necessary tables and relationships in the database
db.exec(schema);

// Export the database connection object so that it can be used in other parts of the application
module.exports = db;