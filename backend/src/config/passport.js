
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const pool = require("./db");

function configureGoogleAuth(passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          "http://localhost:5000/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          const fullName =
            profile.displayName || "FixFlow User";

          if (!email || profile.emails?.[0]?.verified === false) {
            return done(
              new Error("A verified Google email is required.")
            );
          }

          // Reuse an existing account with this email.
          const existingUser = await pool.query(
            `SELECT id, organization_id, full_name, email, role
             FROM users
             WHERE LOWER(email) = $1
             LIMIT 1`,
            [email]
          );

          if (existingUser.rows.length > 0) {
            return done(null, existingUser.rows[0]);
          }

          // New Google accounts join the demo community.
          const organization = await pool.query(
            `SELECT id
             FROM organizations
             WHERE slug = $1
             LIMIT 1`,
            ["fixflow-demo"]
          );

          if (organization.rows.length === 0) {
            return done(
              new Error("FixFlow demo community was not found.")
            );
          }

          // Google sign-in does not provide a password.
          // Generate a random password hash that users cannot know.
          const randomPassword = crypto.randomBytes(48).toString("hex");
          const passwordHash = await bcrypt.hash(randomPassword, 12);

          const result = await pool.query(
            `INSERT INTO users
               (organization_id, full_name, email, password_hash, role)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, organization_id, full_name, email, role`,
            [
              organization.rows[0].id,
              fullName,
              email,
              passwordHash,
              "resident",
            ]
          );

          return done(null, result.rows[0]);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const result = await pool.query(
        `SELECT id, organization_id, full_name, email, role
         FROM users
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return done(null, false);
      }

      done(null, result.rows[0]);
    } catch (error) {
      done(error);
    }
  });
}

module.exports = configureGoogleAuth;
