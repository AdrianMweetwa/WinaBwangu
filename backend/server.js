const express = require("express"); // Import the Express library to create a web server
const path = require("path"); // Import the path module to handle file paths
const db = require("./db"); // Import the database connection object from db.js

const boothsRouter = require("./routes/booths"); // Import the booths router to handle routes related to booths
const servicesRouter = require("./routes/services"); // Import the services router to handle routes related to services
const transactionsRouter = require("./routes/transactions"); // Import the transactions router to handle routes related to transactions
const usersRouter = require("./routes/users"); // Import the users router to handle routes related to users
const authRouter = require("./routes/auth");
const { requireAuth, requireCapability } = require("./middleware/auth");
const { getCookie, getUserForSession } = require("./auth/session");

const app = express(); // Create an instance of the Express application
const PORT = process.env.PORT || 3000; // Render provides PORT at runtime; fallback keeps local development working

app.use(express.json()); // Middleware to parse incoming JSON requests
app.use("/api/auth", authRouter);
app.use("/api/booths", requireAuth, boothsRouter); // Use the booths router for routes related to booths
app.use("/api/services", requireAuth, servicesRouter); // Use the services router for routes related to services
app.use("/api/transactions", requireAuth, transactionsRouter); // Use the transactions router for routes related to transactions
app.use(
  "/api/users",
  requireAuth,
  requireCapability("users.manage"),
  usersRouter,
); // User administration is system-admin only

function serveDashboard(req, res) {
  const user = getUserForSession(getCookie(req, "wb_session"));
  if (!user) return res.redirect("/login");
  return res.sendFile("index.html", {
    root: path.resolve(__dirname, "..", "frontend"),
  });
}

app.get("/", serveDashboard);
app.get("/index.html", serveDashboard);
app.use(
  express.static(path.join(__dirname, "..", "frontend"), { index: false }),
); // Serve authenticated app assets

app.get("/login", (req, res) => {
  res.sendFile("login.html", {
    root: path.resolve(__dirname, "..", "frontend"),
  });
});

app.get("/forgot-password", (req, res) => {
  res.sendFile("forgot-password.html", {
    root: path.resolve(__dirname, "..", "frontend"),
  });
});

// Define a route to handle GET requests to the root URL ("/")
// The route sends the "index.html" file located in the "frontend" directory as a response
app.get("/api/health", (req, res) => {
  const databaseCheck = db.prepare("SELECT 1 AS connected").get(); // Prepare a simple SQL query to test the database connection
  res.json({
    status: "OK",
    database: databaseCheck.connected === 1 ? "Connected" : "Not Connected",
  }); // Send a JSON response indicating the server and database status
});

// Start the server and listen for incoming requests on the specified port
// The callback function logs a message to the console indicating that the server is running and listening on the specified port
app.listen(PORT, () => {
  console.log(`WinaWangu is running on http://localhost:${PORT}`); // Log a message indicating that the server is running and listening on the specified port
});
