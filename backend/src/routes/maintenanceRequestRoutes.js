
const express = require("express");
const pool = require("../config/db");

const {
  requireAuth,
  requireRole,
} = require("../middleware/requireAuth");

const {
  notifyManagers,
  notifyUser,
} = require("../services/notificationService");

const router = express.Router();

// ============================================================
// GET /api/maintenance-requests/technicians
// Fetch technicians belonging to the manager's organization
// ============================================================
router.get(
  "/technicians",
  requireAuth,
  requireRole("manager"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, full_name, email
         FROM users
         WHERE organization_id = $1
           AND role = 'technician'
         ORDER BY full_name ASC`,
        [req.user.organization_id]
      );

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        data: result.rows,
      });
    } catch (error) {
      console.error("Failed to fetch technicians:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch technicians.",
      });
    }
  }
);

// ============================================================
// GET /api/maintenance-requests
// Fetch organization maintenance requests
// ============================================================
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         mr.id,
         mr.organization_id,
         mr.reporter_id,
         mr.assigned_technician_id,
         technician.full_name AS technician_name,
         mr.title,
         mr.description,
         mr.category,
         mr.location,
         mr.priority,
         mr.status,
         mr.is_public,
         mr.completed_by,
         mr.completed_at,
         mr.assigned_at,
         mr.created_at,
         mr.updated_at
       FROM maintenance_requests mr
       LEFT JOIN users technician
         ON technician.id = mr.assigned_technician_id
        AND technician.organization_id = mr.organization_id
        AND technician.role = 'technician'
       WHERE mr.organization_id = $1
       ORDER BY mr.created_at DESC`,
      [req.user.organization_id]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch maintenance requests:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch maintenance requests.",
    });
  }
});

// ============================================================
// POST /api/maintenance-requests
// Create request and notify all managers
// ============================================================
router.post(
  "/",
  requireAuth,
  requireRole("resident"),
  async (req, res) => {
    const {
      title,
      description,
      category,
      location,
      priority,
      is_public,
    } = req.body;

    // Always use authenticated user's identity.
    const organizationId = req.user.organization_id;
    const reporterId = req.user.id;

    // Validate required fields.
    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      typeof location !== "string" ||
      !location.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Title, description, and location are required.",
      });
    }

    const allowedPriorities = [
      "low",
      "medium",
      "high",
      "urgent",
    ];

    if (
      priority &&
      !allowedPriorities.includes(priority)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid priority.",
      });
    }

    if (
      is_public !== undefined &&
      typeof is_public !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "is_public must be a boolean.",
      });
    }

    let client;
    let transactionStarted = false;

    try {
      client = await pool.connect();

      await client.query("BEGIN");
      transactionStarted = true;

      // 1. Create maintenance request.
      const result = await client.query(
        `INSERT INTO maintenance_requests (
           organization_id,
           reporter_id,
           title,
           description,
           category,
           location,
           priority,
           is_public
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          organizationId,
          reporterId,
          title.trim(),
          description.trim(),
          category || null,
          location.trim(),
          priority || "medium",
          is_public ?? false,
        ]
      );

      const newRequest = result.rows[0];

      // 2. Notify all managers in this organization.
      await notifyManagers(client, {
        organizationId,
        requestId: newRequest.id,
        type: "request_created",
        title: "New maintenance request",
        message: `${req.user.full_name} submitted a new request: ${newRequest.title}`,
      });

      // 3. Commit request and notifications together.
      await client.query("COMMIT");
      transactionStarted = false;

      console.log("Maintenance request created:", {
        requestId: newRequest.id,
        organizationId,
        reporterId,
      });

      return res.status(201).json({
        success: true,
        message:
          "Maintenance request created successfully.",
        data: newRequest,
      });
    } catch (error) {
      if (client && transactionStarted) {
        try {
          await client.query("ROLLBACK");
          transactionStarted = false;
        } catch (rollbackError) {
          console.error(
            "Request creation rollback failed:",
            rollbackError
          );
        }
      }

      console.error(
        "Failed to create maintenance request:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to create maintenance request.",
        ...(process.env.NODE_ENV !== "production" && {
          debug: error.message,
        }),
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

// ============================================================
// PATCH /api/maintenance-requests/:id/assign
// Assign, reassign, or unassign technician
// Also notifies relevant users
// ============================================================
router.patch(
  "/:id/assign",
  requireAuth,
  requireRole("manager"),
  async (req, res) => {
    const { id } = req.params;
    const technicianId = req.body?.technician_id;
    const organizationId = req.user.organization_id;

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid maintenance request ID.",
      });
    }

    let assignedTechnicianId = null;

    // null means unassign the technician.
    if (technicianId !== null) {
      if (
        technicianId === undefined ||
        !/^[1-9]\d*$/.test(String(technicianId))
      ) {
        return res.status(400).json({
          success: false,
          message: "Provide a valid technician ID or null.",
        });
      }

      assignedTechnicianId = Number(technicianId);

      if (!Number.isSafeInteger(assignedTechnicianId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid technician ID.",
        });
      }
    }

    let client;
    let transactionStarted = false;

    try {
      client = await pool.connect();

      await client.query("BEGIN");
      transactionStarted = true;

      // 1. Fetch and lock the request.
      const requestResult = await client.query(
        `SELECT
           id,
           organization_id,
           reporter_id,
           assigned_technician_id,
           title,
           status
         FROM maintenance_requests
         WHERE id = $1::integer
           AND organization_id = $2::integer
         FOR UPDATE`,
        [id, organizationId]
      );

      if (requestResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message:
            "Maintenance request not found in your organization.",
        });
      }

      const request = requestResult.rows[0];

      const oldTechnicianId =
        request.assigned_technician_id == null
          ? null
          : Number(request.assigned_technician_id);

      const isSameAssignment =
        String(oldTechnicianId) ===
        String(assignedTechnicianId);

      if (isSameAssignment) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: "This technician is already assigned to the request.",
        });
      }

      // 2. Verify the new technician belongs to this organization.
      let technicianName = null;

      if (assignedTechnicianId !== null) {
        const technicianResult = await client.query(
          `SELECT id, full_name
           FROM users
           WHERE id = $1::integer
             AND organization_id = $2::integer
             AND role = 'technician'`,
          [assignedTechnicianId, organizationId]
        );

        if (technicianResult.rowCount === 0) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(400).json({
            success: false,
            message:
              "The selected technician does not belong to your organization.",
          });
        }

        technicianName = technicianResult.rows[0].full_name;
      }

      // 3. Update technician assignment.
      const updateResult = await client.query(
        `UPDATE maintenance_requests
         SET assigned_technician_id = $1::integer,
             assigned_at = CASE
               WHEN $1::integer IS NULL THEN NULL
               ELSE NOW()
             END,
             updated_at = NOW()
         WHERE id = $2::integer
           AND organization_id = $3::integer
         RETURNING
           id,
           organization_id,
           assigned_technician_id,
           status,
           assigned_at,
           updated_at`,
        [
          assignedTechnicianId,
          id,
          organizationId,
        ]
      );

      if (updateResult.rowCount === 0) {
        throw new Error(
          "Assignment update did not modify any request."
        );
      }

      // 4. Notify the resident.
      let notificationType;
      let notificationTitle;
      let notificationMessage;

      if (assignedTechnicianId === null) {
        notificationType = "technician_unassigned";
        notificationTitle = "Technician assignment removed";
        notificationMessage =
          `The technician assignment for "${request.title}" has been removed.`;
      } else if (oldTechnicianId !== null) {
        notificationType = "technician_reassigned";
        notificationTitle = "Technician reassigned";
        notificationMessage =
          `${technicianName} has been assigned to your request: "${request.title}".`;
      } else {
        notificationType = "technician_assigned";
        notificationTitle = "Technician assigned";
        notificationMessage =
          `${technicianName} has been assigned to your request: "${request.title}".`;
      }

      await notifyUser(client, {
        organizationId,
        userId: request.reporter_id,
        requestId: request.id,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
      });

      // 5. Notify the previously assigned technician, if any.
      if (oldTechnicianId !== null) {
        await notifyUser(client, {
          organizationId,
          userId: oldTechnicianId,
          requestId: request.id,
          type: notificationType,
          title: "Work assignment updated",
          message:
            assignedTechnicianId === null
              ? `You have been unassigned from "${request.title}".`
              : `You have been removed from "${request.title}" because the request was reassigned.`,
        });
      }

      // 6. Notify the newly assigned technician, if any.
      if (assignedTechnicianId !== null) {
        await notifyUser(client, {
          organizationId,
          userId: assignedTechnicianId,
          requestId: request.id,
          type: notificationType,
          title: "New maintenance work assigned",
          message:
            `You have been assigned to "${request.title}". Please review the request and take the necessary action.`,
        });
      }

      // 7. On reassignment, notify all managers in the organization.
      if (
        oldTechnicianId !== null &&
        assignedTechnicianId !== null
      ) {
        await notifyManagers(client, {
          organizationId,
          requestId: request.id,
          type: "technician_reassigned",
          title: "Technician reassigned",
          message:
            `The technician for "${request.title}" has been changed to ${technicianName}.`,
        });
      }

      // 8. Commit assignment and notifications together.
      await client.query("COMMIT");
      transactionStarted = false;

      console.log("Technician assignment successful:", {
        requestId: id,
        oldTechnicianId,
        newTechnicianId: assignedTechnicianId,
        organizationId,
      });

      return res.status(200).json({
        success: true,
        message:
          assignedTechnicianId === null
            ? "Technician assignment removed successfully."
            : oldTechnicianId !== null
              ? "Technician reassigned successfully."
              : "Technician assigned successfully.",
        data: {
          ...updateResult.rows[0],
          technician_name: technicianName,
        },
      });
    } catch (error) {
      if (client && transactionStarted) {
        try {
          await client.query("ROLLBACK");
          transactionStarted = false;
        } catch (rollbackError) {
          console.error(
            "Assignment rollback failed:",
            rollbackError
          );
        }
      }

      console.error("========== ASSIGNMENT ERROR ==========");
      console.error("Message:", error.message);
      console.error("Code:", error.code);
      console.error("Detail:", error.detail);
      console.error("Table:", error.table);
      console.error("Column:", error.column);
      console.error("Constraint:", error.constraint);
      console.error("Stack:", error.stack);
      console.error("======================================");

      return res.status(500).json({
        success: false,
        message: "Failed to assign technician.",
        ...(process.env.NODE_ENV !== "production" && {
          debug: error.message,
          code: error.code || null,
        }),
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);
// ============================================================
// PATCH /api/maintenance-requests/:id/status
// Update status and record history
// ============================================================

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("technician", "manager"),
  async (req, res) => {
    const { id } = req.params;
    const { status, note } = req.body;

    const allowedStatuses = [
      "open",
      "in_progress",
      "resolved",
      "closed",
    ];

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid maintenance request ID.",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status: ${status}.`,
      });
    }

    const userId = req.user.id;
    const userRole = req.user.role;
    const organizationId = req.user.organization_id;

    let client;
    let transactionStarted = false;

    try {
      client = await pool.connect();

      await client.query("BEGIN");
      transactionStarted = true;

      // 1. Fetch and lock the request.
      const requestResult = await client.query(
        `SELECT
           id,
           organization_id,
           reporter_id,
           assigned_technician_id,
           title,
           status
         FROM maintenance_requests
         WHERE id = $1::integer
           AND organization_id = $2::integer
         FOR UPDATE`,
        [id, organizationId]
      );

      if (requestResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "Maintenance request not found.",
        });
      }

      const request = requestResult.rows[0];

      // 2. Technicians can only update their assigned requests.
      if (
        userRole === "technician" &&
        (
          request.assigned_technician_id == null ||
          String(request.assigned_technician_id) !==
            String(userId)
        )
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          success: false,
          message:
            "You can only update requests assigned to you.",
        });
      }

      // 3. Prevent duplicate status updates.
      if (request.status === status) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: `This request is already ${status}.`,
        });
      }

      // 4. Update maintenance request.
      const updatedResult = await client.query(
        `UPDATE maintenance_requests
         SET status = $1::varchar,
             completed_by = CASE
               WHEN $1::varchar = 'resolved' THEN $2::integer
               WHEN $1::varchar IN ('open', 'in_progress', 'closed')
                    AND status = 'resolved' THEN NULL
               ELSE completed_by
             END,
             completed_at = CASE
               WHEN $1::varchar = 'resolved' THEN NOW()
               WHEN $1::varchar IN ('open', 'in_progress', 'closed')
                    AND status = 'resolved' THEN NULL
               ELSE completed_at
             END,
             updated_at = NOW()
         WHERE id = $3::integer
           AND organization_id = $4::integer
         RETURNING *`,
        [
          status,
          userId,
          id,
          organizationId,
        ]
      );

      // 5. Record status history.
      await client.query(
        `INSERT INTO request_status_history (
           organization_id,
           request_id,
           changed_by,
           old_status,
           new_status,
           note
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          request.organization_id,
          id,
          userId,
          request.status,
          status,
          typeof note === "string"
            ? note.trim() || null
            : null,
        ]
      );

      // 6. Send notifications only when work is completed.
      if (
        status === "resolved" &&
        request.status !== "resolved"
      ) {
        // Notify the resident who created the request.
        await notifyUser(client, {
          organizationId,
          userId: request.reporter_id,
          requestId: request.id,
          type: "request_resolved",
          title: "Maintenance work completed",
          message:
            `Your maintenance request "${request.title}" has been completed successfully.`,
        });

        // Notify all managers, if a technician completed the work.
        if (userRole === "technician") {
          await notifyManagers(client, {
            organizationId,
            requestId: request.id,
            type: "request_resolved",
            title: "Maintenance request completed",
            message:
              `The technician has completed the maintenance request "${request.title}".`,
          });
        }

        console.log("Completion notifications created:", {
          requestId: request.id,
          organizationId,
          reporterId: request.reporter_id,
          completedBy: userId,
        });
      }

      // 7. Commit status, history, and notifications together.
      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        success: true,
        message: "Request status updated successfully.",
        data: updatedResult.rows[0],
      });
    } catch (error) {
      if (client && transactionStarted) {
        try {
          await client.query("ROLLBACK");
          transactionStarted = false;
        } catch (rollbackError) {
          console.error(
            "Status update rollback failed:",
            rollbackError
          );
        }
      }

      console.error("Status update failed:", {
        message: error.message,
        code: error.code,
        detail: error.detail,
        table: error.table,
        column: error.column,
        constraint: error.constraint,
      });

      return res.status(500).json({
        success: false,
        message: "Failed to update request status.",
        ...(process.env.NODE_ENV !== "production" && {
          debug: error.message,
          code: error.code,
        }),
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);


// ============================================================
// GET /api/maintenance-requests/completed/recent
// Fetch recently completed requests
// ============================================================
router.get(
  "/completed/recent",
  requireAuth,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           mr.id,
           mr.title,
           mr.category,
           mr.location,
           mr.priority,
           mr.status,
           mr.completed_at,
           completer.id AS completed_by,
           completer.full_name AS completed_by_name
         FROM maintenance_requests mr
         LEFT JOIN users completer
           ON completer.id = mr.completed_by
         WHERE mr.organization_id = $1
           AND mr.status = 'resolved'
           AND mr.completed_at IS NOT NULL
         ORDER BY mr.completed_at DESC
         LIMIT 20`,
        [req.user.organization_id]
      );

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        "Failed to fetch completed requests:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch recently completed requests.",
      });
    }
  }
);

// ============================================================
// GET /api/maintenance-requests/public?organization_id=1
// Public work board
// ============================================================
router.get("/public", async (req, res) => {
  const organizationId = Number(req.query.organization_id);

  if (
    !Number.isSafeInteger(organizationId) ||
    organizationId <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid organization_id is required.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         mr.id,
         mr.organization_id,
         mr.title,
         mr.description,
         mr.category,
         mr.location,
         mr.priority,
         mr.status,
         mr.assigned_technician_id,
         mr.created_at,
         mr.updated_at,
         mr.assigned_at,
         mr.completed_at,
         technician.full_name AS technician_name,

         (
           SELECT MIN(h.created_at)
           FROM request_status_history h
           WHERE h.request_id = mr.id
             AND h.organization_id = mr.organization_id
             AND h.new_status = 'in_progress'
         ) AS work_started_at

       FROM maintenance_requests mr

       LEFT JOIN users technician
         ON technician.id = mr.assigned_technician_id
        AND technician.organization_id = mr.organization_id
        AND technician.role = 'technician'

       WHERE mr.organization_id = $1
         AND mr.is_public = TRUE

       ORDER BY mr.created_at DESC`,
      [organizationId]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Public work board error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch public maintenance requests.",
    });
  }
});

module.exports = router;
