# Extension Documentation

Detailed documentation for the Hiya Coordinator VS Code extension.

## Overview

The VS Code extension provides the user interface and client-side functionality for Hiya Coordinator. It manages the webview panel, handles audio recording, communicates with the backend server, and manages generated code patches.

## Module Structure

### Core Extension (`src/extension.ts`)

**Purpose:** Extension entry point that activates the extension and registers commands.

**Responsibilities:**
- Activates the extension on startup
- Registers VS Code commands
- Creates and manages the coordinator panel
- Handles extension lifecycle (activate/deactivate)

**Commands:**
- `hiyaCoordinator.connect` - Opens the coordinator panel
- `hiyaCoordinator.toggleSpeech` - Toggles speech recognition on/off

**Configuration:**
- `hiyaCoordinator.backendUrl` - Backend server URL (default: http://localhost:3000)

### Panel Management (`src/panel.ts`)

**Purpose:** Manages the webview panel, coordinates between webview and audio recorder, and handles patch saving.

**Responsibilities:**
- Creates and manages webview panel lifecycle
- Handles messages from webview to extension
- Manages audio recording state
- Saves generated patches to workspace
- Coordinates between webview UI and audio recorder
- Initializes webview with backend URL

**Key Functions:**
- `show()` - Creates or reveals the webview panel
- `createWebviewPanel()` - Creates the webview panel with proper configuration
- `initializeWebview()` - Sends initialization message to webview
- `setupMessageHandlers()` - Sets up message handlers from webview
- `handleWebviewMessage()` - Processes messages from webview
- `handleStartRecording()` - Starts audio recording
- `handleStopRecording()` - Stops audio recording
- `handleGenerateCode()` - Triggers code generation
- `handleSavePatches()` - Saves generated patches to workspace
- `playAudio()` - Sends audio playback request to webview
- `setupCallbacks()` - Sets up callbacks for audio recorder
- `getWebviewHtml()` - Generates HTML content for webview
- `dispose()` - Cleans up resources

### Audio Recorder (`src/audioRecorder.ts`)

**Purpose:** Manages microphone input, WebSocket connection to backend, and handles backend messages.

**Responsibilities:**
- Captures microphone input using `mic` package
- Manages WebSocket connection to backend
- Streams audio data to backend in real-time
- Handles transcription and code generation callbacks
- Manages recording state and connection lifecycle

**Key Functions:**
- `startRecording()` - Starts audio recording and WebSocket connection
- `stopRecording()` - Stops audio recording
- `setupMicrophone()` - Initializes microphone with configuration
- `sendStartCommand()` - Sends start command to backend
- `setupAudioStream()` - Sets up audio stream handlers
- `connectWebSocket()` - Establishes WebSocket connection
- `setupWebSocketHandlers()` - Configures WebSocket event handlers
- `sendMessage()` - Sends messages through WebSocket
- `ensureConnected()` - Ensures WebSocket is connected
- `disconnect()` - Closes WebSocket connection
- `dispose()` - Cleans up all resources

**Configuration:**
- Audio rate: 16000 Hz
- Channels: 1 (mono)
- Encoding: LINEAR16
- Language: en-US

**Callbacks:**
- `setTranscriptionCallback()` - Sets callback for transcription results
- `setCodeGenerationCallback()` - Sets callback for code generation results
- `setAudioPlaybackCallback()` - Sets callback for audio playback
- `setDisconnectCallback()` - Sets callback for disconnection events

### Utilities (`src/utils/`)

#### Webview Messages (`webviewMessages.ts`)

**Purpose:** Centralizes sending messages from extension to webview.

**Responsibilities:**
- Sends messages to webview panel
- Displays info/error messages in VS Code
- Provides type-safe message sending

**Key Functions:**
- `sendToWebview()` - Sends message to webview panel
- `showInfo()` - Shows info message in VS Code and webview
- `showError()` - Shows error message in VS Code and webview

#### HTML Generator (`htmlGenerator.ts`)

**Purpose:** Generates HTML content for webview with proper security (CSP) and resource URIs.

**Responsibilities:**
- Generates HTML with Content Security Policy (CSP)
- Creates nonces for script security
- Handles resource URI generation (CSS, JS)
- Builds CSP content with proper directives

**Key Functions:**
- `generateNonce()` - Generates random nonce for CSP
- `buildCSPContent()` - Builds CSP content string
- `getWebviewUris()` - Gets webview URIs for media files
- `generateWebviewHtml()` - Main function to generate HTML

**Security:**
- CSP prevents XSS attacks
- Nonces ensure script integrity
- Resource URIs are properly sanitized

#### File Operations (`fileOperations.ts`)

**Purpose:** Encapsulates file system operations related to saving patches.

**Responsibilities:**
- Saves patch files to workspace
- Creates patches directory if it doesn't exist
- Handles file naming and path management
- Validates patch file data

**Key Functions:**
- `savePatches()` - Saves patch files to workspace patches directory
- `createPatchesDirectory()` - Creates patches directory
- `getSafeFilename()` - Converts filename to safe format
- `savePatchFile()` - Saves a single patch file

**File Structure:**
- Patches are saved to `{workspace}/patches/` directory
- Filenames are sanitized (slashes replaced with underscores)
- Patch files have `.patch` extension

#### Callbacks (`callbacks.ts`)

**Purpose:** Provides factory functions for creating callbacks used by audio recorder.

**Responsibilities:**
- Creates transcription callbacks
- Creates disconnect callbacks
- Creates code generation callbacks
- Creates audio playback callbacks

**Key Functions:**
- `createTranscriptionCallback()` - Creates callback for transcription results
- `createDisconnectCallback()` - Creates callback for disconnection events
- `createCodeGenerationCallback()` - Creates callback for code generation results
- `createAudioPlaybackCallback()` - Creates callback for audio playback

### WebSocket (`src/websocket/messageHandler.ts`)

**Purpose:** Handles incoming WebSocket messages from backend and routes them to appropriate callbacks.

**Responsibilities:**
- Parses WebSocket messages from backend
- Routes messages to appropriate callbacks
- Handles different message types (transcription, code generation, audio playback)

**Message Types:**
- `transcription` - Transcription results (interim and final)
- `code_generation_result` - Code generation results
- `audio_playback` - Audio data for playback
- `error` - Error messages
- `disconnected` - Disconnection notifications

**Key Functions:**
- `handleWebSocketMessage()` - Main message handler that routes messages

### Type Definitions (`src/types/`)

#### Mic Types (`mic.d.ts`)

**Purpose:** Provides TypeScript type definitions for the `mic` package.

**Responsibilities:**
- Defines types for microphone API
- Provides IntelliSense support
- Ensures type safety for microphone operations

**Interfaces:**
- `MicrophoneOptions` - Configuration options for microphone
- `Microphone` - Microphone interface with methods

### Webview Media (`media/`)

#### HTML (`panel.html`)

**Purpose:** HTML template for the webview panel.

**Structure:**
- Repository connection form (URL, user name, branch)
- Action buttons (Speech Recognition, Generate Code)
- Loading animation
- Transcription display area
- Status messages

#### CSS (`panel.css`)

**Purpose:** Styling for the webview panel.

**Features:**
- Modern, clean UI design
- Status message styling (error, connected, normal)
- Loading animation
- Responsive layout
- Transcription area styling

#### JavaScript Modules

##### Main Panel (`panel.js`)

**Purpose:** Main webview JavaScript that handles user interactions and coordinates with extension.

**Responsibilities:**
- Handles user interactions (connect, record, generate code)
- Manages connection state
- Processes messages from extension
- Coordinates UI updates
- Initializes event listeners

**Key Functions:**
- `connect()` - Connects to repository via REST API
- `toggleSpeech()` - Toggles speech recognition
- `generateCode()` - Triggers code generation
- `handleMessage()` - Processes messages from extension
- `initializeEventListeners()` - Sets up event listeners

##### Audio Module (`audio.js`)

**Purpose:** Handles audio playback in the webview.

**Responsibilities:**
- Unlocks audio context during user gesture
- Plays audio using Web Audio API
- Falls back to HTML5 Audio if needed
- Handles audio format conversion

**Key Functions:**
- `unlockAudio()` - Unlocks audio context
- `playAudio()` - Main audio playback function
- `playAudioWithWebAudio()` - Plays audio using Web Audio API
- `playAudioWithHTML5()` - Plays audio using HTML5 Audio
- `base64ToArrayBuffer()` - Converts base64 to ArrayBuffer
- `base64ToBlob()` - Converts base64 to Blob

##### UI Module (`ui.js`)

**Purpose:** Manages UI state and DOM updates.

**Responsibilities:**
- Updates connection state
- Updates recording state
- Displays transcriptions
- Shows loading animations
- Handles status messages
- Manages button states

**Key Functions:**
- `showStatus()` - Shows status message
- `updateConnectionState()` - Updates connection UI state
- `updateRecordingState()` - Updates recording UI state
- `addTranscription()` - Adds transcription to display
- `showLoadingAnimation()` - Shows/hides loading animation
- `setGenerateCodeButtonEnabled()` - Enables/disables generate button
- `handleCodeGenerationResult()` - Handles code generation result display

## Data Flow

### Connection Flow

1. User enters repository URL, name, and branch in webview
2. Webview sends connect request to extension
3. Extension sends REST API request to backend
4. Backend returns connection info (repoId, userName, branch)
5. Extension stores connection info and notifies webview
6. Webview updates UI to show connected state

### Recording Flow

1. User clicks "Start Speech Recognition" in webview
2. Webview sends `startRecording` message to extension
3. Extension starts audio recorder
4. Audio recorder connects to backend WebSocket
5. Audio recorder sends `start` command with connection info
6. Backend creates recognition stream
7. Audio chunks are streamed to backend
8. Backend sends transcriptions back to extension
9. Extension sends transcriptions to webview for display

### Code Generation Flow

1. User clicks "Generate Code" in webview
2. Webview sends `generateCode` message to extension
3. Extension sends `generate_code` command to backend via WebSocket
4. Backend retrieves conversation history from database
5. Backend generates code using AI agent
6. Backend sends code generation result to extension
7. Extension saves patches to workspace
8. Extension sends patches to webview
9. Extension sends audio summary to webview for playback
10. Webview displays result and plays audio

## Configuration

### VS Code Settings

- `hiyaCoordinator.backendUrl` - Backend server URL (default: http://localhost:3000)

### Extension Manifest

- Activation event: `onStartupFinished`
- Commands: `hiyaCoordinator.connect`, `hiyaCoordinator.toggleSpeech`
- Capabilities: microphone access, untrusted workspaces

## Development

### Compiling TypeScript

```bash
npm run compile
```

### Watch Mode (Auto-compile)

```bash
npm run watch
```
