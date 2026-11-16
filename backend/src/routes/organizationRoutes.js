const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// GET /api/organizations
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, slug, created_at
       FROM organizations
       ORDER BY id ASC`
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch organizations:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch organizations.",
    });
  }
});

module.exports = router;