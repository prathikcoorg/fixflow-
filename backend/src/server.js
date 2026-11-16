
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const path = require("path");

require("dotenv").config();

const pool = require("./config/db");
const configureGoogleAuth = require("./config/passport");

const organizationRoutes = require("./routes/organizationRoutes");
const maintenanceRequestRoutes = require("./routes/maintenanceRequestRoutes");
const authRoutes = require("./routes/authRoutes");
const notificationRoutes = require("./routes/notifications");

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure the session secret exists.
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing.");
}

// Render runs behind a proxy. Required for secure production cookies.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// CORS is only needed for local frontend development.
// In production, React and the API use the same domain.
if (process.env.NODE_ENV !== "production") {
  app.use(
    cors({
      origin: "http://localhost:5173",
      credentials: true,
    })
  );
}

app.use(express.json());

// PostgreSQL-backed sessions.
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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// Google authentication.
configureGoogleAuth(passport);

app.use(passport.initialize());
app.use(passport.session());

// API routes.
app.use("/api/organizations", organizationRoutes);
app.use("/api/maintenance-requests", maintenanceRequestRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);

// Backend health check.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Fixora API is running!",
  });
});

// Database health check.
app.get("/api/health/db", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database"
    );

    res.status(200).json({
      success: true,
      message: "PostgreSQL connected successfully!",
      database: result.rows[0].database,
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed.",
    });
  }
});

// Serve the built React frontend.
// backend/src/server.js -> project-root/dist
const frontendPath = path.resolve(__dirname, "../../dist");

app.use(express.static(frontendPath));

// React Router fallback: serve index.html for frontend routes.
app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(path.join(frontendPath, "index.html"), (error) => {
    if (error) {
      next(error);
    }
  });
});

// Start server.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Fixora server running on port ${PORT}`);
});
