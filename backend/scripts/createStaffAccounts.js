
const bcrypt = require("bcrypt");
const readline = require("readline");
const pool = require("../src/config/db");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  try {
    console.log("\nFixFlow AI — Staff Account Setup\n");

    const organizationResult = await pool.query(
      `SELECT id, name
       FROM organizations
       WHERE slug = $1`,
      ["fixflow-demo"]
    );

    if (organizationResult.rowCount === 0) {
      throw new Error("FixFlow Demo Community was not found.");
    }

    const organization = organizationResult.rows[0];

    console.log(`Community: ${organization.name}`);
    console.log(`Organization ID: ${organization.id}\n`);

    const accounts = [
      { role: "manager", label: "Manager" },
      { role: "technician", label: "Technician" },
    ];

    for (const account of accounts) {
      console.log(`\n--- ${account.label} Account ---`);

      const fullName = (await ask("Full name: ")).trim();
      const email = (await ask("Email: ")).trim().toLowerCase();
      const password = await ask("Password (minimum 12 characters): ");

      if (!fullName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Please enter a valid name and email.");
      }

      if (password.length < 12) {
        throw new Error("Password must be at least 12 characters.");
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // Do not silently change an existing user's role.
      const existing = await pool.query(
        `SELECT id, role
         FROM users
         WHERE LOWER(email) = $1
         LIMIT 1`,
        [email]
      );

      if (existing.rowCount > 0) {
        console.log(
          `An account already exists for ${email} (role: ${existing.rows[0].role}).`
        );
        console.log("Skipping it; existing accounts are not modified.");
        continue;
      }

      await pool.query(
        `INSERT INTO users (
           organization_id,
           full_name,
           email,
           password_hash,
           role
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [
          organization.id,
          fullName,
          email,
          passwordHash,
          account.role,
        ]
      );

      console.log(`${account.label} account created successfully.`);
    }

    console.log("\nStaff account setup finished.");
  } catch (error) {
    console.error("\nSetup failed:", error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
}

main();
