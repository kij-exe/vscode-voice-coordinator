import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { registerRepo, connectUser } from './routes/repos.js';
import { setupWebSocket } from './websocket/audioHandler.js';
import { connectDatabase, closeDatabase } from './db/database.js';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// REST API Routes
app.post('/api/repos/register', registerRepo);
app.post('/api/repos/connect', connectUser);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// WebSocket server for audio streaming
console.log('Creating WebSocket server...');
const wss = new WebSocketServer({ server });
setupWebSocket(wss);

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

wss.on('listening', () => {
  console.log('WebSocket server is listening for connections');
});

// Connect to database and start server
const dbConnectionString = process.env.DATABASE_URL;
if (!dbConnectionString) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// Initialize database connection and start server
(async () => {
  try {
    await connectDatabase(dbConnectionString);
    
    // Initialize storage
    initStorage();

    // Start server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`WebSocket server ready for connections`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await closeDatabase();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await closeDatabase();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

