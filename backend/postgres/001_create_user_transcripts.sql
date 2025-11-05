-- Create user_transcripts table
-- This table stores all transcriptions with timestamps

CREATE TABLE IF NOT EXISTS user_transcripts (
  git_repo VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  branch VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  transcription TEXT NOT NULL
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_transcripts_lookup 
ON user_transcripts(git_repo, username, branch, timestamp);
