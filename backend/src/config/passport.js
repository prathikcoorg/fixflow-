
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const pool = require("./db");

function configureGoogleAuth(passport) {
  // Use the production callback URL on Render.
  // Use localhost only during local development.
  const isProduction =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.RENDER_EXTERNAL_URL);

  const callbackURL = isProduction
    ? "https://fixora-lzci.onrender.com/api/auth/google/callback"
    : "http://localhost:5000/api/auth/google/callback";

  console.log("Google OAuth callback URL:", callbackURL);

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          const fullName = profile.displayName || "FixFlow User";

          if (!email || profile.emails?.[0]?.verified === false) {
            return done(
              new Error("A verified Google email is required.")
            );
          }

          // Check whether the Google account already exists.
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

          // Find the default FixFlow demo organization.
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

          // Generate a random password for Google-only accounts.
          const randomPassword = crypto.randomBytes(48).toString("hex");
          const passwordHash = await bcrypt.hash(randomPassword, 12);

          // Create a new resident account.
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
          console.error("Google authentication error:", error);
          return done(error);
        }
      }
    )
  );

  // Serialize user into the session.
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Retrieve user from the session.
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

      return done(null, result.rows[0]);
    } catch (error) {
      console.error("Session deserialization error:", error);
      return done(error);
    }
  });
}

module.exports = configureGoogleAuth;
