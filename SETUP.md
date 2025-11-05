# Setup Guide

## Backend Setup

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Set up Google Cloud Speech-to-Text:**
   - Create a Google Cloud project
   - Enable the Speech-to-Text API
   - Create a service account and download the JSON key file
   - Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to your key file:
     ```bash
     export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
     ```
   - Or create a `.env` file in the `backend` directory:
     ```
     GOOGLE_APPLICATION_CREDENTIALS=./path/to/your/service-account-key.json
     PORT=3000
     DATABASE_URL=postgresql://username:password@localhost:5432/database_name
     DB_SSL=false
     ```

3. **Set up PostgreSQL database:**
   - Create a PostgreSQL database
   - Create the `user_transcripts` table
   - Set the `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_HOST`, `DB_PORT` environment variables in your `.env` file

4. **Start the server:**
   ```bash
   npm start
   ```
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

The server will run on `http://localhost:3000` by default.

## Extension Setup

1. **Install dependencies:**
   ```bash
   cd extension
   npm install
   ```

   **Note:** The extension uses the `mic` package for microphone access. On Linux, you may need to install SoX:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install sox libsox-fmt-all
   
   # Arch Linux
   sudo pacman -S sox
   
   # macOS
   brew install sox
   ```

2. **Compile TypeScript:**
   ```bash
   npm run compile
   ```

3. **Open in VSCode:**
   - Open the `extension` folder in VSCode
   - Press F5 to launch a new Extension Development Host window
   - In the new window, open the Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Run the command: "Hiya Coordinator: Connect to Repository"

4. **Configure backend URL (optional):**
   - Open Settings (Ctrl+, / Cmd+,)
   - Search for "Hiya Coordinator"
   - Set the "Backend Url" if your backend is not running on `http://localhost:3000`

## Usage

1. **Connect to a repository:**
   - Open the Hiya Coordinator panel (via Command Palette: "Hiya Coordinator: Connect to Repository")
   - Enter your repository URL (e.g., `https://github.com/user/repo`)
   - Enter your name
   - Optionally specify a branch (defaults to `main`)
   - Click "Connect"

2. **Start speech recognition:**
   - After connecting, click "Start Speech Recognition"
   - Grant microphone permissions when prompted
   - Your speech will be transcribed in real-time
   - Final transcriptions are saved to the conversation history

3. **View transcriptions:**
   - All transcriptions appear in the "Conversation" section
   - Interim results are shown in italics
   - Final results are shown in bold

## Architecture Notes

- **Backend**: Express.js server with WebSocket support for real-time audio streaming
- **Speech-to-Text**: Google Cloud Speech-to-Text API with streaming recognition
- **Storage**: File-based storage for repositories and conversations (per repo/user/branch)
- **Extension**: VSCode extension with webview panel for UI and browser-based audio capture
