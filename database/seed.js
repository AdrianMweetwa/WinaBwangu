// load the existing database connection from db.js
const db = require("../backend/db");

// add the Wina Bwangu booths array to the database
const booths = [
  ["Wina1", "Lusaka CPD"],
  ["Wina2", "Libala"],
  ["Wina3", "Kabwata"],
  ["Wina4", "Mandevu"],
  ["Wina5", "Woodlands"],
  ["Wina6", "Matero East"],
];

const insertBooth = db.prepare(
  "INSERT OR IGNORE INTO booths (booth, location) VALUES (?, ?)",
); // Prepare an SQL statement to insert a new booth into the booths table
for (const booth of booths) {
  insertBooth.run(booth[0], booth[1]); // Execute the prepared statement for each booth in the booths array
}

// add the services array to the database
const services = [
  ["Airtel Money", 350000, 0.05],
  ["MTN Money", 160000, 0.06],
  ["Zamtel Money", 70000, 0.045],
  ["Zanaco", 80000, 0.035],
  ["FNB", 80000, 0.04],
];

const insertService = db.prepare(
  "INSERT OR IGNORE INTO services (service, monthly_transaction_limit, revenue_rate) VALUES (?, ?, ?)",
); // Prepare an SQL statement to insert a new service into the services table
for (const service of services) {
  insertService.run(service[0], service[1], service[2]); // Execute the prepared statement for each service in the services array
}

// Link each booth to the services they offer in the booth_services table
const boothServices = [
  ["Wina1", "Airtel Money", "MTN Money", "Zamtel Money", "Zanaco", "FNB"],
  ["Wina2", "Airtel Money", "MTN Money", "Zamtel Money", "FNB"],
  ["Wina3", "Airtel Money", "MTN Money", "Zamtel Money", "Zanaco", "FNB"],
  ["Wina4", "Airtel Money", "MTN Money", "Zamtel Money"],
  ["Wina5", "Airtel Money", "MTN Money", "Zanaco", "FNB"],
  ["Wina6", "Airtel Money", "MTN Money", "Zamtel Money"],
];

const findBooth = db.prepare(`
    SELECT id FROM booths WHERE booth = ?
`); // Prepare an SQL statement to find a booth by its booth and retrieve its ID

const findService = db.prepare(`
    SELECT id FROM services WHERE service = ?
`); // Prepare an SQL statement to find a service by its service and retrieve its ID

const insertBoothService = db.prepare(
  "INSERT OR IGNORE INTO booth_services (booth_id, service_id) VALUES (?, ?)",
); // Prepare an SQL statement to link a booth to a service in the booth_services table

for (const boothService of boothServices) {
  const boothCode = boothService[0]; // Get the booth code from the current array
  const booth = findBooth.get(boothCode); // Find the booth ID using its code
  for (let i = 1; i < boothService.length; i++) {
    // Loop through the services offered by the booth, starting from index 1
    const serviceName = boothService[i]; // Get the service name
    const service = findService.get(serviceName); // Find the service ID using its name
    insertBoothService.run(booth.id, service.id); // Link the booth and service using their database IDs
  }
}

console.log("Database seeded successfully!"); // Log a message indicating that the database seeding process has completed successfully
