const express = require("express");
const path = require("path");
const db = require("./db");

const boothsRouter = require("./routes/booths");
const servicesRouter = require("./routes/services");
const transactionsRouter = require("./routes/transactions");
const usersRouter = require("./routes/users");
const authRouter = require("./routes/auth");
const { requireAuth, requireCapability } = require("./middleware/auth");
const { getCookie, getUserForSession } = require("./auth/session");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/booths", requireAuth, boothsRouter);
app.use("/api/services", requireAuth, servicesRouter);
app.use("/api/transactions", requireAuth, transactionsRouter);
app.use(
  "/api/users",
  requireAuth,
  requireCapability("users.manage"),
  usersRouter,
);

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
);

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

app.get("/api/health", (req, res) => {
  const databaseCheck = db.prepare("SELECT 1 AS connected").get();
  res.json({
    status: "OK",
    database: databaseCheck.connected === 1 ? "Connected" : "Not Connected",
  });
});

app.listen(PORT, () => {
  console.log(`WinaWangu is running on http://localhost:${PORT}`);
});
