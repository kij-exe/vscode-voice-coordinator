import { readFile, readdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { simpleGit } from 'simple-git';
import { createPatch } from 'diff';
import OpenAI from 'openai';

// Lazy initialization of OpenAI client (initialized when first needed)
let openaiClient = null;

/**
 * Get or initialize the OpenAI client
 * @returns {OpenAI} The OpenAI client instance
 */
function getOpenAIClient() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openaiClient;
}

/**
 * Clean up temporary directory (ignores errors)
 * @param {string} tempDir - Temporary directory path
 */
async function cleanupTempDir(tempDir) {
  if (!tempDir || !existsSync(tempDir)) return;
  
  try {
    await rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('Warning: Failed to clean up temp directory:', error.message);
  }
}

/**
 * Clone repository to a temporary directory
 * @param {string} repoUrl - Git repository URL
 * @param {string} branch - Branch name
 * @returns {Promise<{repoPath: string, tempDir: string}>} Repository path and temp directory
 */
async function cloneRepository(repoUrl, branch) {
  const tempDir = join(tmpdir(), `repo-${Date.now()}`);
  const repoPath = join(tempDir, 'repo');

  console.log(`Cloning repository ${repoUrl} to ${tempDir}...`);
  
  const git = simpleGit();
  await git.clone(repoUrl, repoPath, ['--depth', '1', '--branch', branch]);
  
  return { repoPath, tempDir };
}

/**
 * Get all files in a directory recursively
 * @param {string} dir - Directory path
 * @param {string} baseDir - Base directory for relative paths
 * @returns {Promise<Array<string>>} Array of file paths relative to baseDir
 */
async function getAllFiles(dir, baseDir = dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = join(dir, entry.name);
    const relativePath = fullPath.replace(baseDir + '/', '');

    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Get list of all files in a git repository
 * @param {string} repoUrl - Git repository URL
 * @param {string} branch - Branch name
 * @returns {Promise<Array<string>>} Array of file paths
 */
async function listRepoFiles(repoUrl, branch) {
  let tempDir = null;

  try {
    const { repoPath, tempDir: dir } = await cloneRepository(repoUrl, branch);
    tempDir = dir;
    const files = await getAllFiles(repoPath, repoPath);
    await cleanupTempDir(tempDir);
    return files;
  } catch (error) {
    await cleanupTempDir(tempDir);
    throw new Error(`Failed to list files: ${error.message}`);
  }
}

/**
 * Get content of a specific file from a git repository
 * @param {string} repoUrl - Git repository URL
 * @param {string} branch - Branch name
 * @param {string} filePath - Path to the file relative to repo root
 * @returns {Promise<string>} File content
 */
async function getFileContent(repoUrl, branch, filePath) {
  let tempDir = null;

  try {
    const { repoPath, tempDir: dir } = await cloneRepository(repoUrl, branch);
    tempDir = dir;

    const fullPath = join(repoPath, filePath);
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await readFile(fullPath, 'utf-8');
    await cleanupTempDir(tempDir);
    return content;
  } catch (error) {
    await cleanupTempDir(tempDir);
    throw new Error(`Failed to get file content: ${error.message}`);
  }
}

/**
 * Format conversation transcripts into a readable text string
 * @param {Array<Object>} conversations - Array of conversation transcripts
 * @returns {string} Formatted conversation text
 */
function formatConversations(conversations) {
  return conversations
    .map(conv => `[${conv.timestamp}] ${conv.username}: ${conv.transcription}`)
    .join('\n');
}

/**
 * Create agent tools configuration for OpenAI API
 * @returns {Array<Object>} Array of tool definitions
 */
function createAgentTools() {
  return [
    {
      type: 'function',
      function: {
        name: 'list_repo_files',
        description: `Lists all files in the git repository on the specified branch. 
        This tool takes no parameters - it automatically uses the repository URL and branch provided in the context.
        Returns an array of file paths relative to the repository root.
        Use this tool first to understand the repository structure before making changes.`,
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_file_content',
        description: `Retrieves the complete content of a specific file from the git repository on the specified branch.
        This tool requires the filePath parameter which should be the path to the file relative to the repository root (e.g., 'src/index.js' or 'package.json').
        Use this tool to read files that need to be modified or to understand existing code structure.
        
        IMPORTANT: Always use the exact file path as returned by list_repo_files. The filePath must be relative to the repository root, not an absolute path.`,
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'The path to the file relative to the repository root. Must match exactly one of the paths returned by list_repo_files. Examples: "src/index.js", "package.json", "backend/server.js"'
            }
          },
          required: ['filePath']
        }
      }
    }
  ];
}

/**
 * Create system prompt for the code generation agent
 * @param {string} repoUrl - Git repository URL
 * @param {string} branch - Branch name
 * @returns {string} System prompt text
 */
function createSystemPrompt(repoUrl, branch) {
  return `You are an AI code generation agent. Based on the conversation transcript provided, analyze the requirements and generate code changes.

Your task:
1. Analyze the conversation to understand what code changes are needed
2. Use the available tools to explore the repository structure and relevant files:
   - First, call list_repo_files to see all files in the repository
   - Then, call get_file_content for each file you need to read or modify
3. After exploring the codebase, generate code changes
4. Some of the requirements may have been already met,
   only generate code changes if the requirements have not been met.

CRITICAL: You MUST output your final response in valid JSON format with this exact structure:
{
  "summary": "A brief summary of the changes made, e.g., 'I added ..' ",
  "files": [
    {
      "filename": "path/to/file.js",
      "new_content": "complete file content with changes"
    }
  ]
}

Important:
- Feel free to add new files if they are not already present in the repository.
- Only include files that need to be changed or created
- Provide the complete content for each file (not just diffs)
- Make sure the code is syntactically correct and follows best practices
- The filename must be relative to the repository root (as returned by list_repo_files)
- The repository URL is: ${repoUrl}
- The branch is: ${branch}
- When you are ready to output the final result, respond with ONLY the JSON object, no additional text before or after`;
}

/**
 * Execute a tool call and return the result
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} toolArgs - Arguments for the tool
 * @param {string} repoUrl - Git repository URL
 * @param {string} branch - Branch name
 * @returns {Promise<Object>} Tool execution result
 */
async function executeToolCall(toolName, toolArgs, repoUrl, branch) {
  try {
    if (toolName === 'list_repo_files') {
      return { files: await listRepoFiles(repoUrl, branch) };
    } else if (toolName === 'get_file_content') {
      return { content: await getFileContent(repoUrl, branch, toolArgs.filePath) };
    } else {
      return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Parse agent response and extract JSON result
 * @param {string} content - Response content from the agent
 * @returns {Object} Parsed result object
 */
function parseAgentResponse(content) {
  const contentStr = content || '{}';
  const jsonMatch = typeof contentStr === 'string' ? contentStr.match(/\{[\s\S]*\}/) : null;
  const result = JSON.parse(jsonMatch ? jsonMatch[0] : contentStr);

  if (!result.summary || !Array.isArray(result.files)) {
    throw new Error('Invalid response format: missing summary or files array');
  }

  return result;
}

/**
 * Generate patch for a single file
 * @param {Object} file - File object with filename and new_content
 * @param {string} repoUrl - Git repository URL
 * @param {string} branch - Branch name
 * @returns {Promise<Object>} File with patch
 */
async function generateFilePatch(file, repoUrl, branch) {
  try {
    let originalContent = '';
    try {
      originalContent = await getFileContent(repoUrl, branch, file.filename);
    } catch {
      // File doesn't exist (new file)
    }

    return {
      filename: file.filename,
      patch: createPatch(
        file.filename,
        originalContent,
        file.new_content,
        `Original ${file.filename}`,
        `Modified ${file.filename}`
      )
    };
  } catch (error) {
    console.error(`Error generating patch for ${file.filename}:`, error);
    return {
      filename: file.filename,
      patch: `Error generating patch: ${error.message}\n\nOriginal content:\n${file.new_content}`
    };
  }
}

/**
 * Convert file changes to patches
 * @param {Array<Object>} files - Array of file objects with filename and new_content
 * @param {string} repoUrl - Git repository URL
 * @param {string} branch - Branch name
 * @returns {Promise<Array<Object>>} Array of files with patches
 */
async function generatePatches(files, repoUrl, branch) {
  return Promise.all(files.map(file => generateFilePatch(file, repoUrl, branch)));
}

/**
 * Process tool calls from the agent message
 * @param {Array<Object>} toolCalls - Array of tool call objects
 * @param {string} repoUrl - Git repository URL
 * @param {string} branch - Branch name
 * @returns {Promise<Array<Object>>} Array of tool response messages
 */
async function processToolCalls(toolCalls, repoUrl, branch) {
  const toolResponses = [];

  for (const toolCall of toolCalls) {
    const toolName = toolCall.function.name;
    const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
    const toolResult = await executeToolCall(toolName, toolArgs, repoUrl, branch);

    toolResponses.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(toolResult)
    });
  }

  return toolResponses;
}

/**
 * Run a single iteration of the agent conversation
 * @param {OpenAI} client - OpenAI client instance
 * @param {Array<Object>} messages - Current conversation messages
 * @param {Array<Object>} tools - Agent tools configuration
 * @returns {Promise<Object>} Response message from the agent
 */
async function runAgentIteration(client, messages, tools) {
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    messages: messages,
    tools: tools,
    temperature: 0.7,
    response_format: { type: 'json_object' }
  });

  return response.choices[0].message;
}

/**
 * Run the agent conversation loop
 * @param {OpenAI} client - OpenAI client instance
 * @param {Array<Object>} messages - Initial conversation messages
 * @param {Array<Object>} tools - Agent tools configuration
 * @param {string} repoUrl - Git repository URL
 * @param {string} branch - Branch name
 * @param {number} maxIterations - Maximum number of iterations
 * @returns {Promise<Object>} Final agent response result
 */
async function runAgentLoop(client, messages, tools, repoUrl, branch, maxIterations = 10) {
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const message = await runAgentIteration(client, messages, tools);
    messages.push(message);

    if (message.tool_calls?.length > 0) {
      // Process tool calls
      const toolResponses = await processToolCalls(message.tool_calls, repoUrl, branch);
      messages.push(...toolResponses);
    } else {
      // Agent has finished and provided the final answer
      try {
        const result = parseAgentResponse(message.content);
        result.files = await generatePatches(result.files, repoUrl, branch);
        return result;
      } catch (error) {
        console.error('Error parsing agent response:', error);
        return {
          summary: typeof message.content === 'string' ? message.content.substring(0, 200) : 'Code generation completed',
          files: []
        };
      }
    }
  }

  throw new Error('Agent exceeded maximum iterations');
}

/**
 * Generate code based on conversation using MCP agent
 * @param {string} repoUrl - Git repository URL
 * @param {string} branch - Branch name
 * @param {Array<Object>} conversations - Array of conversation transcripts
 * @returns {Promise<Object>} Generated code with summary and file changes
 */
export async function generateCodeFromConversation(repoUrl, branch, conversations) {
  const client = getOpenAIClient();

  try {
    const conversationText = formatConversations(conversations);
    console.log(`\n=== Starting Code Generation ===`);
    console.log(`Repo: ${repoUrl}, Branch: ${branch}, Messages: ${conversations.length}\n`);

    const tools = createAgentTools();
    const systemPrompt = createSystemPrompt(repoUrl, branch);
    const userPrompt = `Based on the following conversation, generate the necessary code changes:\n\n${conversationText}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const result = await runAgentLoop(client, messages, tools, repoUrl, branch);

    console.log('\n=== Code Generation Complete ===');
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Error in code generation:', error);
    throw error;
  }
}

