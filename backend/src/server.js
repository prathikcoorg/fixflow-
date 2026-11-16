
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");

require("dotenv").config();

// Database
const pool = require("./config/db");

// Authentication
const configureGoogleAuth = require("./config/passport");

// Routes
const organizationRoutes = require("./routes/organizationRoutes");
const maintenanceRequestRoutes = require("./routes/maintenanceRequestRoutes");
const authRoutes = require("./routes/authRoutes");
const notificationRoutes = require("./routes/notifications");

const app = express();
const PORT = process.env.PORT || 5000;

// Validate environment variables
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing from backend/.env");
}

// --------------------------------------------------
// 1. CORS CONFIGURATION
// --------------------------------------------------

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// --------------------------------------------------
// 2. BODY PARSER
// --------------------------------------------------

app.use(express.json());

// --------------------------------------------------
// 3. SESSION CONFIGURATION
// --------------------------------------------------

const PgSession = require("connect-pg-simple")(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Local HTTP development only
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// --------------------------------------------------
// 4. PASSPORT AUTHENTICATION
// --------------------------------------------------

configureGoogleAuth(passport);

app.use(passport.initialize());
app.use(passport.session());

// --------------------------------------------------
// 5. API ROUTES
// --------------------------------------------------

app.use("/api/organizations", organizationRoutes);

app.use("/api/maintenance-requests", maintenanceRequestRoutes);

app.use("/api/auth", authRoutes);

app.use("/api/notifications", notificationRoutes);

// --------------------------------------------------
// 6. BACKEND HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "FixFlow AI backend is running!",
  });
});

// --------------------------------------------------
// 7. DATABASE HEALTH CHECK
// --------------------------------------------------

app.get("/api/health/db", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database, version() AS version"
    );

    res.status(200).json({
      success: true,
      message: "PostgreSQL connected successfully!",
      database: result.rows[0].database,
      version: result.rows[0].version,
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed.",
    });
  }
});

// --------------------------------------------------
// 8. START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`FixFlow AI API running at http://localhost:${PORT}`);
});
