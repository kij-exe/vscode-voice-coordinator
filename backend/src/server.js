import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { registerRepo, connectUser } from './routes/repos.js';
import { setupWebSocket } from './websocket/connectionManager.js';
import { connectDatabase } from './db/database.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

/**
 * Build database connection string from environment variables
 * @returns {string} Database connection string
 */
function buildDatabaseConnectionString() {
  const { POSTGRES_USER, POSTGRES_PASSWORD, DB_HOST, DB_PORT, POSTGRES_DB } = process.env;
  return `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${DB_HOST}:${DB_PORT}/${POSTGRES_DB}`;
}

/**
 * Setup Express middleware
 * @param {express.Application} app - Express application
 */
function setupMiddleware(app) {
  app.use(cors());
  app.use(express.json());
}

/**
 * Setup REST API routes
 * @param {express.Application} app - Express application
 */
function setupRoutes(app) {
  app.post('/api/repos/register', registerRepo);
  app.post('/api/repos/connect', connectUser);
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
}

/**
 * Setup WebSocket server
 * @param {Object} server - HTTP server instance
 * @returns {WebSocketServer} WebSocket server instance
 */
function setupWebSocketServer(server) {
  console.log('Creating WebSocket server...');
  const wss = new WebSocketServer({ server });
  setupWebSocket(wss);

  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  wss.on('listening', () => {
    console.log('WebSocket server is listening for connections');
  });

  return wss;
}

/**
 * Start the server
 * @returns {Promise<void>}
 */
async function startServer() {
  try {
    // Connect to database
    const dbConnectionString = buildDatabaseConnectionString();
    await connectDatabase(dbConnectionString);

    // Setup Express app
    const app = express();
    setupMiddleware(app);
    setupRoutes(app);

    // Create HTTP server
    const server = createServer(app);

    // Setup WebSocket server
    setupWebSocketServer(server);

    // Start server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('WebSocket server ready for connections');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

