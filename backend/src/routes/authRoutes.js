
const express = require("express");
const passport = require("passport");
const bcrypt = require("bcrypt");
const pool = require("../config/db");

const router = express.Router();

// Automatically use the correct frontend URL in development and production.
const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  "http://localhost:5173";

const DASHBOARD_ROUTES = {
  resident: "/resident",
  technician: "/technician",
  manager: "/manager",
};

// Google sign-in — intended for residents
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: true,
  })
);

// Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${FRONTEND_URL}/login?error=google_auth_failed`,
    session: true,
  }),
  (req, res) => {
    if (req.user?.role !== "resident") {
      return req.logout((error) => {
        if (error) {
          return res.redirect(
            `${FRONTEND_URL}/login?error=logout_failed`
          );
        }

        return req.session.destroy(() => {
          res.redirect(
            `${FRONTEND_URL}/login?error=resident_login_only`
          );
        });
      });
    }

    return res.redirect(`${FRONTEND_URL}/resident`);
  }
);

// Email/password login for technicians and managers
router.post("/login", async (req, res, next) => {
  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

  const password =
    typeof req.body.password === "string"
      ? req.body.password
      : "";

  const requestedRole = req.body.role;

  if (!["technician", "manager"].includes(requestedRole)) {
    return res.status(400).json({
      success: false,
      message: "Choose technician or manager login.",
    });
  }

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         id,
         organization_id,
         full_name,
         email,
         password_hash,
         role
       FROM users
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];

    if (
      !user ||
      !user.password_hash ||
      !["technician", "manager"].includes(user.role)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches || user.role !== requestedRole) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Regenerate session after successful credential validation.
    req.session.regenerate((sessionError) => {
      if (sessionError) {
        return next(sessionError);
      }

      req.login(
        {
          id: user.id,
          organization_id: user.organization_id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        },
        (loginError) => {
          if (loginError) {
            return next(loginError);
          }

          return res.status(200).json({
            success: true,
            message: "Login successful.",
            redirect: DASHBOARD_ROUTES[user.role],
            user: {
              id: user.id,
              organization_id: user.organization_id,
              full_name: user.full_name,
              email: user.email,
              role: user.role,
            },
          });
        }
      );
    });
  } catch (error) {
    console.error("Login failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to log in right now.",
    });
  }
});

// Get authenticated user
router.get("/me", (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated.",
    });
  }

  const {
    id,
    organization_id,
    full_name,
    email,
    role,
  } = req.user;

  return res.status(200).json({
    success: true,
    user: {
      id,
      organization_id,
      full_name,
      email,
      role,
    },
  });
});

// Logout
router.post("/logout", (req, res, next) => {
  req.logout((logoutError) => {
    if (logoutError) {
      return next(logoutError);
    }

    req.session.destroy((sessionError) => {
      if (sessionError) {
        return next(sessionError);
      }

      res.clearCookie("connect.sid", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      return res.status(200).json({
        success: true,
        message: "Logged out successfully.",
      });
    });
  });
});

module.exports = router;
