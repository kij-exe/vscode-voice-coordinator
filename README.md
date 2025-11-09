# Hiya Coordinator

A VS Code extension that enables real-time collaborative development through voice conversations with AI agent support.

## Overview

Hiya Coordinator combines voice recognition, AI-powered code generation, and real-time collaboration to create a natural voice-driven development experience. Users can:

- Connect to a Git repository
- Speak coding instructions through voice
- Receive real-time transcriptions
- Generate code patches automatically
- Review and apply generated patches to the repository

## Architecture

The project consists of two main components:

1. **Backend Server** - Node.js server handling WebSocket connections, speech recognition, AI code generation, and database operations
2. **VS Code Extension** - Frontend extension providing the user interface, audio capture, and patch management

### Communication Flow

```
VS Code Extension → WebSocket → Backend Server → Google Speech-to-Text
                                                      ↓
VS Code Extension ← WebSocket ← Backend Server ← AI Agent (OpenAI)
                                                      ↓
                                                PostgreSQL Database
```

## Project Structure

### Backend (`/backend`)

The backend server handles all server-side operations. See [backend/README.md](./backend/README.md) for detailed module documentation.

**Key Components:**
- **Server** - Main entry point, sets up HTTP and WebSocket servers
- **Routes** - REST API endpoints for repository management
- **WebSocket** - Real-time communication handlers
- **Speech** - Google Cloud Speech-to-Text and Text-to-Speech integration
- **Database** - PostgreSQL operations for storing transcriptions
- **AI Agent** - OpenAI-powered code generation

### Extension (`/extension`)

The VS Code extension provides the user interface and client-side functionality. See [extension/README.md](./extension/README.md) for detailed module documentation.

**Key Components:**
- **Extension** - Extension entry point and command registration
- **Panel** - Webview panel management and coordination
- **Audio Recorder** - Microphone input and WebSocket communication
- **Utilities** - Helper functions for webview messages, HTML generation, file operations, and callbacks
- **WebSocket** - Message handling for backend communication
- **Webview** - HTML, CSS, and JavaScript for the webview UI

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - HTTP server framework
- **WebSocket (ws)** - Real-time communication
- **Google Cloud Speech-to-Text** - Speech recognition
- **Google Cloud Text-to-Speech** - Speech synthesis
- **OpenAI API** - AI code generation
- **PostgreSQL** - Database for transcriptions
- **simple-git** - Git operations

### Extension
- **TypeScript** - Type-safe JavaScript
- **VS Code Extension API** - Extension framework
- **WebView API** - Panel UI
- **mic** - Microphone input
- **WebSocket (ws)** - Backend communication

## Quick Start

### Backend Setup

```bash
cd backend
npm install
# Configure .env file with API keys and database credentials
npm start
```

### Extension Setup

```bash
cd extension
npm install
npm run compile
```

### Running the Extension

1. Open VS Code
2. Press F5 to launch Extension Development Host
3. Run "Hiya Coordinator: Connect to Repository" command

## Usage

1. **Connect to Repository:**
   - Open the Hiya Coordinator panel
   - Enter repository URL, your name, and branch
   - Click "Connect"

2. **Start Speech Recognition:**
   - Click "Start Speech Recognition"
   - Grant microphone permissions
   - Speak your coding instructions
   - View real-time transcriptions

3. **Generate Code:**
   - Click "Generate Code" after speaking instructions
   - Wait for AI agent to analyze and generate code
   - Review generated patch files in `patches/` directory
   - Apply patches to your repository

## Environment Variables

### Backend (`.env`)

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

## Documentation

- [Backend Documentation](./backend/README.md) - Detailed backend module documentation
- [Extension Documentation](./extension/README.md) - Detailed extension module documentation

## Development

### Backend Development

```bash
cd backend
npm run dev  # Auto-reload on file changes
```

### Extension Development

```bash
cd extension
npm run watch  # Auto-compile TypeScript on file changes
```
