/**
 * Notify all managers in the same organization.
 */
async function notifyManagers(
  client,
  {
    organizationId,
    requestId,
    type,
    title,
    message,
  }
) {
  if (
    !client ||
    !organizationId ||
    !requestId ||
    !type ||
    !title ||
    !message
  ) {
    throw new Error("Missing required data for manager notification.");
  }

  const result = await client.query(
    `INSERT INTO notifications (
       organization_id,
       user_id,
       request_id,
       type,
       title,
       message
     )
     SELECT
       $1::integer,
       u.id,
       $2::integer,
       $3,
       $4,
       $5
     FROM users u
     WHERE u.organization_id = $1
       AND u.role = 'manager'
     RETURNING id, user_id, request_id`,
    [organizationId, requestId, type, title, message]
  );

  console.log(
    `Created ${result.rowCount} manager notification(s) for request ${requestId}.`
  );

  return result.rows;
}

/**
 * Notify one specific user.
 */
async function notifyUser(
  client,
  {
    organizationId,
    userId,
    requestId,
    type,
    title,
    message,
  }
) {
  if (
    !client ||
    !organizationId ||
    !userId ||
    !requestId ||
    !type ||
    !title ||
    !message
  ) {
    throw new Error("Missing required data for user notification.");
  }

  const result = await client.query(
    `INSERT INTO notifications (
       organization_id,
       user_id,
       request_id,
       type,
       title,
       message
     )
     SELECT
       $1::integer,
       u.id,
       $3::integer,
       $4,
       $5,
       $6
     FROM users u
     WHERE u.id = $2::integer
       AND u.organization_id = $1::integer
     RETURNING id, user_id, request_id`,
    [
      organizationId,
      userId,
      requestId,
      type,
      title,
      message,
    ]
  );

  if (result.rowCount === 0) {
    throw new Error(
      `Notification recipient ${userId} was not found in organization ${organizationId}.`
    );
  }

  console.log(
    `Created ${result.rowCount} notification(s) for user ${userId}, request ${requestId}.`
  );

  return result.rows[0];
}

module.exports = {
  notifyManagers,
  notifyUser,
};