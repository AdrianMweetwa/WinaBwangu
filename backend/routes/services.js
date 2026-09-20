const express = require('express'); // Import the Express library to create a web server
const db = require('../db'); // Import the database connection object from db.js
const router = express.Router(); // Create a new router object to handle routes related to services

router.get('/', (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY id').all(); // Retrieve all services from the database
  res.json(services); // Send a JSON response containing the list of services
});

module.exports = router; // Export the router object so that it can be used in other parts of the application