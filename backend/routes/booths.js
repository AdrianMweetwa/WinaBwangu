const express = require("express"); // Import the Express library to create a web server

const db = require("../db"); // Import the database connection object from db.js
const router = express.Router(); // Create a new router object to handle routes related to booths

router.get("/", (req, res) => { 
  const booths = db.prepare("SELECT * FROM booths ORDER BY id").all(); // Retrieve all booths from the database
  res.json(booths); // Send a JSON response containing the list of booths
});

router.get("/:booth/services", (req, res) => {
    const booth = db.prepare("SELECT * FROM booths WHERE booth = ?").get(req.params.booth); // Retrieve the booth with the specified booth code from the database
    if (!booth) {
        return res.status(404).json({ error: "Booth not found" }); // If the booth is not found, send a 404 response with an error message
    }

    // Retrieve all services offered by the specified booth from the database
    // Use a JOIN query to get the services associated with the booth from the booth_services table
    // The query selects all columns from the services table and joins it with the booth_services table on the service_id
    // The WHERE clause filters the results to only include services associated with the specified booth_id
    const services = db.prepare(`
        SELECT * FROM services
        JOIN booth_services ON services.id = booth_services.service_id
        WHERE booth_services.booth_id = ? ORDER BY services.id
    `).all(booth.id); // Retrieve all services offered by the specified booth from the database

    
    res.json({booth: booth, services: services }); // Send a JSON response containing the list of services offered by the specified booth
});


module.exports = router; // Export the router object so that it can be used in other parts of the application
