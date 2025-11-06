import pg from 'pg';
const { Pool } = pg;

let pool = null;

/**
 * Initialize database connection pool
 * @param {string} connectionString - PostgreSQL connection string
 * @returns {Promise<void>}
 */
export async function connectDatabase(connectionString) {
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
 * Save a new transcription to the database
 * @param {string} gitRepo - Git repository URL or identifier
 * @param {string} username - Username
 * @param {string} branch - Git branch name
 * @param {string} transcription - The transcribed text
 * @param {string} timestamp - ISO timestamp string (optional, defaults to now)
 * @returns {Promise<Object>} The inserted record
 */
export async function putTranscription(gitRepo, username, branch, transcription, timestamp = null) {
  console.log(`[putTranscription] repo: ${gitRepo}, user: ${username}, branch: ${branch}, ts: ${timestamp || "start of time"}`);
  const pool = getPool();
  const ts = timestamp || new Date().toISOString();

  const query = `
    INSERT INTO user_transcripts (git_repo, username, branch, timestamp, transcription)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;

  try {
    const result = await pool.query(query, [gitRepo, username, branch, ts, transcription]);
    console.log(`Saved transcription: ${transcription.substring(0, 50)}...`);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving transcription:', error);
    throw error;
  }
}

/**
 * Get all transcriptions for a git repo, username, and branch after a certain timestamp
 * @param {string} gitRepo - Git repository URL or identifier
 * @param {string} username - Username (optional)
 * @param {string} branch - Git branch name (optional)
 * @param {string} afterTimestamp - ISO timestamp string (optional, defaults to beginning of time)
 * @returns {Promise<Array>} Array of transcription records
 */
export async function getTranscriptions(gitRepo, username, branch, afterTimestamp = null) {
  const pool = getPool();

  let query = `
    SELECT git_repo, username, branch, timestamp, transcription
    FROM user_transcripts
    WHERE git_repo = $1
  `;
  const params = [gitRepo];

  query += ` AND username = $2`;
  params.push(username);

  query += ` AND branch = $3`;
  params.push(branch);
    
  if (afterTimestamp) query += ` AND timestamp > $4`;
  params.push(afterTimestamp);

  query += ` ORDER BY timestamp ASC`;

  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error getting transcriptions:', error);
    throw error;
  }
}

/**
 * Get transcriptions from the last N minutes for a git repo, username, and branch
 * @param {string} gitRepo - Git repository URL or identifier
 * @param {string} username - Username
 * @param {string} branch - Git branch name
 * @param {number} minutesAgo - Number of minutes to look back (default: 60)
 * @returns {Promise<Array>} Array of transcription records
 */
export async function getRecentTranscriptions(gitRepo, username, branch, minutesAgo = 60) {
  const pool = getPool();

  const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

  const query = `
    SELECT git_repo, username, branch, timestamp, transcription
    FROM user_transcripts
    WHERE git_repo = $1
      AND username = $2
      AND branch = $3
      AND timestamp > $4
    ORDER BY timestamp ASC
  `;

  try {
    const result = await pool.query(query, [gitRepo, username, branch, cutoffTime]);
    return result.rows;
  } catch (error) {
    console.error('Error getting recent transcriptions:', error);
    throw error;
  }
}

/**
 * Get transcriptions from the last N minutes for a git repo and branch (all users)
 * @param {string} gitRepo - Git repository URL or identifier
 * @param {string} branch - Git branch name
 * @param {number} minutesAgo - Number of minutes to look back (default: 60)
 * @returns {Promise<Array>} Array of transcription records
 */
export async function getRecentTranscriptionsForBranch(gitRepo, branch, minutesAgo = 60) {
  const pool = getPool();

  const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

  const query = `
    SELECT git_repo, username, branch, timestamp, transcription
    FROM user_transcripts
    WHERE git_repo = $1
      AND branch = $2
      AND timestamp > $3
    ORDER BY timestamp ASC
  `;

  try {
    const result = await pool.query(query, [gitRepo, branch, cutoffTime]);
    return result.rows;
  } catch (error) {
    console.error('Error getting recent transcriptions for branch:', error);
    throw error;
  }
}
