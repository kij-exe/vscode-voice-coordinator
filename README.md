# Hiya Coordinator

A VSCode extension that enables real-time collaborative development through voice conversations, with AI agent support.

## Architecture

### Backend Server
- Express.js server with WebSocket support
- Google Speech-to-Text API integration
- Repository registration and connection management
- Conversation storage per repo/user/branch

### VSCode Extension
- Repository connection interface
- Speech recognition toggle
- Real-time audio streaming to backend
- Message display for transcriptions

## Setup

### Backend
```bash
cd backend
npm install
npm start
```

### Extension
```bash
cd extension
npm install
npm run compile
```
