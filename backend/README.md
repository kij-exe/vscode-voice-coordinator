# Backend Documentation

Detailed documentation for the Hiya Coordinator backend server.

## Overview

The backend server is a Node.js application that handles WebSocket connections, speech recognition, AI code generation, and database operations. It serves as the central hub for processing voice inputs, generating code, and managing conversation state.

## Module Structure

### Core Server (`src/server.js`)

**Purpose:** Main entry point that orchestrates server setup and initialization.

**Responsibilities:**
- Creates Express.js HTTP server
- Sets up WebSocket server
- Initializes database connection
- Configures middleware (CORS, JSON parsing)
- Registers REST API routes
- Handles server startup and error handling

**Key Functions:**
- `buildDatabaseConnectionString()` - Constructs PostgreSQL connection string from environment variables
- `setupMiddleware()` - Configures Express middleware
- `setupRoutes()` - Registers REST API endpoints
- `setupWebSocketServer()` - Creates and configures WebSocket server
- `startServer()` - Main server startup function

### API Routes (`src/routes/repos.js`)

**Purpose:** Handles REST API endpoints for repository registration and user connections.

**Endpoints:**
- `POST /api/repos/register` - Registers a new repository in the system
- `POST /api/repos/connect` - Connects a user to a repository and returns connection information

**Responsibilities:**
- Repository registration and management
- User-repository association
- Connection info generation (repoId, userName, branch)
- UUID generation for repository identification

### WebSocket Communication (`src/websocket/`)

#### Connection Manager (`connectionManager.js`)

**Purpose:** Manages WebSocket connection lifecycle and message routing.

**Responsibilities:**
- Handles new WebSocket connections
- Manages connection state (recognizeStream, connectionInfo)
- Parses incoming messages (distinguishes audio from JSON)
- Routes messages to appropriate handlers
- Handles connection close and error events

**Key Components:**
- `ConnectionState` class - Encapsulates connection state (stream, info)
- `parseMessage()` - Parses binary (audio) and text (JSON) messages
- `handleConnectionClose()` - Cleans up resources on disconnect
- `handleConnectionError()` - Handles connection errors
- `setupWebSocket()` - Main WebSocket server setup function

#### Message Handlers (`messageHandlers.js`)

**Purpose:** Processes different types of WebSocket messages and executes corresponding actions.

**Responsibilities:**
- Starts/stops speech recognition streams
- Processes audio data and forwards to Google Speech-to-Text
- Handles code generation requests
- Manages transcription callbacks
- Sends responses back to clients

**Message Types:**
- `start` - Initiates speech recognition stream
- `stop` - Stops speech recognition
- `generate_code` - Triggers AI code generation
- `ping` - Keep-alive ping/pong

**Key Functions:**
- `handleStartRecognition()` - Creates recognition stream with Google Speech-to-Text
- `handleStopRecognition()` - Stops recognition stream
- `handleAudioData()` - Forwards audio chunks to recognition stream
- `handleCodeGeneration()` - Orchestrates code generation process
- `generateCode()` - Calls AI agent to generate code
- `generateAudioFromSummary()` - Synthesizes audio from code generation summary
- `sendTranscription()` - Sends transcription results to client

### Speech Processing (`src/speech/`)

#### Speech Handler (`speechHandler.js`)

**Purpose:** Integrates with Google Cloud Speech-to-Text API for real-time speech recognition.

**Responsibilities:**
- Creates and manages recognition streams
- Handles streaming audio recognition
- Processes transcription results (interim and final)
- Saves transcriptions to database
- Manages recognition errors and stream lifecycle

**Key Functions:**
- `createRecognitionRequest()` - Builds recognition request configuration
- `handleRecognitionError()` - Handles recognition stream errors
- `saveTranscription()` - Saves final transcriptions to database
- `handleRecognitionData()` - Processes recognition results
- `processTranscriptionResult()` - Processes and formats transcription data
- `createRecognitionStream()` - Main function to create and configure recognition stream

**Configuration:**
- Audio encoding: LINEAR16
- Sample rate: 16000 Hz
- Language: en-US (configurable)
- Streaming recognition for real-time results

#### Text-to-Speech (`textToSpeech.js`)

**Purpose:** Integrates with Google Cloud Text-to-Speech API for speech synthesis.

**Responsibilities:**
- Synthesizes speech from text
- Validates and truncates text input
- Converts text to audio format (MP3)
- Handles audio response processing

**Key Functions:**
- `validateText()` - Validates text input
- `truncateText()` - Truncates text to maximum length
- `createSynthesisRequest()` - Builds synthesis request
- `processAudioResponse()` - Processes audio response from API
- `synthesizeSpeech()` - Main function for speech synthesis

**Configuration:**
- Voice: en-US-Wavenet-D (configurable)
- Audio format: MP3
- Maximum text length: 5000 characters

### Database (`src/db/database.js`)

**Purpose:** Manages PostgreSQL database operations for storing and retrieving transcriptions.

**Responsibilities:**
- Establishes database connection
- Stores transcriptions with metadata (repoId, userName, branch, timestamp)
- Retrieves transcriptions by repository, user, and branch
- Manages database connection lifecycle
- Handles SSL configuration

**Key Functions:**
- `connectDatabase()` - Establishes PostgreSQL connection
- `putTranscription()` - Stores a transcription in the database
- `getTranscriptions()` - Retrieves transcriptions with filtering
- `getRecentTranscriptions()` - Gets recent transcriptions for a repository/user/branch
- `getRecentTranscriptionsForBranch()` - Gets recent transcriptions for a specific branch

**Database Schema:**
- Table: `user_transcripts`
- Columns: id, repo_id, user_name, branch, transcript, created_at
- Indexes on repo_id, user_name, branch, created_at for efficient queries

### AI Agent (`src/agent/codeAgent.js`)

**Purpose:** Generates code patches using OpenAI API based on conversation history and repository context.

**Responsibilities:**
- Clones and analyzes Git repositories
- Processes conversation history
- Generates code using OpenAI API
- Creates git patch files for generated code changes
- Manages repository file operations

**Key Functions:**
- `cloneRepository()` - Clones repository to temporary directory
- `cleanupTempDir()` - Cleans up temporary directories
- `listRepoFiles()` - Lists files in repository
- `getFileContent()` - Retrieves file contents from repository
- `formatConversations()` - Formats conversation history for AI prompt
- `createSystemPrompt()` - Creates system prompt for AI agent
- `createAgentTools()` - Defines tools available to AI agent
- `executeToolCall()` - Executes tool calls from AI agent
- `generateFilePatch()` - Generates git patch for a file
- `generatePatches()` - Generates patches for multiple files
- `processToolCalls()` - Processes tool call responses from AI
- `parseAgentResponse()` - Parses AI agent responses
- `runAgentIteration()` - Runs a single agent iteration
- `runAgentLoop()` - Main agent loop with iterative refinement
- `generateCodeFromConversation()` - Main function to generate code from conversation

**AI Agent Features:**
- Uses OpenAI GPT-4 with function calling
- Iterative code generation with refinement
- Context-aware code suggestions
- Repository file analysis
- Git patch generation
- Conversation history integration

## Data Flow

### Speech Recognition Flow

1. Client sends `start` message with connection info and audio config
2. Server creates Google Speech-to-Text recognition stream
3. Audio chunks are forwarded to recognition stream
4. Interim and final transcriptions are sent back to client
5. Final transcriptions are saved to database

### Code Generation Flow

1. Client sends `generate_code` message
2. Server retrieves conversation history from database
3. Server clones repository to temporary directory
4. Server analyzes repository structure and files
5. Server calls OpenAI API with conversation history and repository context
6. AI agent generates code using function calling
7. Server creates git patches for generated code
8. Server synthesizes audio summary using Text-to-Speech
9. Server sends patches and audio to client

## Configuration

### Environment Variables

```env
# Server
PORT=3000

# Database
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
POSTGRES_DB=hiya_coordinator
DB_SSL=false

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account-key.json

# OpenAI
OPENAI_API_KEY=your_openai_api_key
```

### Google Cloud Setup

1. Enable Speech-to-Text and Text-to-Speech APIs
2. Create service account and download JSON key
3. Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable

### Database Setup

1. Create PostgreSQL database
2. Run migration script: `postgres/001_create_user_transcripts.sql`
3. Configure connection in `.env` file

## Development

### Running the Server

```bash
npm start
```

### Development Mode (Auto-reload)

```bash
npm run dev
```
