const { nextId } = require('./idGenerator');

/**
 * Write an audit log entry. Accepts an optional `client` so it can be called
 * from inside an existing transaction (e.g. admission, discharge) and become
 * part of the same atomic operation.
 */
async function writeAudit(client, { adminId, action, entityType = null, entityId = null, description }) {
  const runner = client ? client.query.bind(client) : require('../config/db').query;
  const logId = await nextId('log', client);
  await runner(
    `INSERT INTO audit_logs (log_id, admin_id, action, entity_type, entity_id, description)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [logId, adminId, action, entityType, entityId, description]
  );
  return logId;
}

module.exports = { writeAudit };
