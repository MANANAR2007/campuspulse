import { getDbStatus } from '../config/db.js';

/**
 * Health check controller
 * Confirms that the Express backend and database connection are operational.
 */
export const getHealth = (req, res) => {
  const dbStatus = getDbStatus();

  res.status(200).json({
    status: 'ok',
    service: 'CampusPulse API',
    database: dbStatus,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};
