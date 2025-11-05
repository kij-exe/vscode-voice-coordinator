import { getPool } from '../db/database.js';

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
