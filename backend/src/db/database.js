import pg from 'pg';
const { Pool } = pg;

let pool = null;

/**
 * Initialize database connection pool
 * @param {string} connectionString - PostgreSQL connection string
 * @returns {Promise<void>}
 */
export async function connectDatabase(connectionString) {
  console.log('connectDatabase', connectionString);
  if (pool) {
    console.log('Database connection pool already exists');
    return;
  }

  try {
    pool = new Pool({
      connectionString: connectionString,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    // Test the connection
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    client.release();
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw error;
  }
}

/**
 * Get the database connection pool
 * @returns {Pool}
 */
export function getPool() {
  if (!pool) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return pool;
}

/**
 * Close database connection pool
 * @returns {Promise<void>}
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database connection pool closed');
  }
}

