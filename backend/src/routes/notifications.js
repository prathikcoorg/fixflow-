
const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const { requireAuth } = require("../middleware/requireAuth");

// GET all notifications for the logged-in user
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         request_id,
         type,
         title,
         message,
         is_read,
         created_at
       FROM notifications
       WHERE user_id = $1
         AND organization_id = $2
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id, req.user.organization_id]
    );

    res.json({
      success: true,
      notifications: result.rows,
    });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications.",
    });
  }
});

// GET unread notification count
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::integer AS unread_count
       FROM notifications
       WHERE user_id = $1
         AND organization_id = $2
         AND is_read = false`,
      [req.user.id, req.user.organization_id]
    );

    res.json({
      success: true,
      unreadCount: result.rows[0].unread_count,
    });
  } catch (error) {
    console.error("Unread count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch unread count.",
    });
  }
});

// MARK one notification as read
router.patch("/:id/read", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE notifications
       SET is_read = true
       WHERE id = $1
         AND user_id = $2
         AND organization_id = $3
       RETURNING id, is_read`,
      [id, req.user.id, req.user.organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    res.json({
      success: true,
      notification: result.rows[0],
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update notification.",
    });
  }
});

// MARK all notifications as read
router.patch("/read-all", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = true
       WHERE user_id = $1
         AND organization_id = $2
         AND is_read = false`,
      [req.user.id, req.user.organization_id]
    );

    res.json({
      success: true,
      message: "All notifications marked as read.",
      updatedCount: result.rowCount,
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update notifications.",
    });
  }
});

module.exports = router;
