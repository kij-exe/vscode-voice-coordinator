import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import OpenAI from 'openai';

const execAsync = promisify(exec);

// Initialize OpenAI client (will be null if API key not set)
let openaiClient = null;
if (process.env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

/**
 * Get list of all files in a git repository
 * @param {string} repoUrl - Git repository URL
 * @param {string} branch - Branch name
 * @returns {Promise<Array<string>>} Array of file paths
 */
async function listRepoFiles(repoUrl, branch) {
  try {
    // Create a temporary directory for cloning
    const tempDir = join(tmpdir(), `repo-${Date.now()}`);
    const repoPath = join(tempDir, 'repo');

    console.log(`Cloning repository ${repoUrl} to ${tempDir}...`);
    
    // Clone the repository
    await execAsync(`git clone --depth 1 --branch ${branch} ${repoUrl} ${repoPath}`, {
      timeout: 60000
    });

    // Get list of all files
    const { stdout } = await execAsync(`find ${repoPath} -type f -not -path '*/\.*'`, {
      cwd: tempDir
    });

    // Clean up paths to be relative to repo root
    const files = stdout
      .split('\n')
      .filter(line => line.trim())
      .map(file => file.replace(repoPath + '/', ''))
      .filter(file => !file.includes('.git'));

    // Clean up temp directory
    await execAsync(`rm -rf ${tempDir}`);

    return files;
  } catch (error) {
    console.error('Error listing repo files:', error);
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
  try {
    // Create a temporary directory for cloning
    const tempDir = join(tmpdir(), `repo-${Date.now()}`);
    const repoPath = join(tempDir, 'repo');

    console.log(`Cloning repository ${repoUrl} to ${tempDir}...`);
    
    // Clone the repository
    await execAsync(`git clone --depth 1 --branch ${branch} ${repoUrl} ${repoPath}`, {
      timeout: 60000
    });

    const fullPath = join(repoPath, filePath);
    
    if (!existsSync(fullPath)) {
      await execAsync(`rm -rf ${tempDir}`);
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await readFile(fullPath, 'utf-8');

    // Clean up temp directory
    await execAsync(`rm -rf ${tempDir}`);

    return content;
  } catch (error) {
    console.error('Error getting file content:', error);
    throw new Error(`Failed to get file content: ${error.message}`);
  }
}

/**
 * Generate code based on conversation using MCP agent
 * @param {string} repoUrl - Git repository URL
 * @param {string} branch - Branch name
 * @param {Array<Object>} conversations - Array of conversation transcripts
 * @returns {Promise<Object>} Generated code with summary and file changes
 */
export async function generateCodeFromConversation(repoUrl, branch, conversations) {
  if (!openaiClient) {
    throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
  }

  try {
    // Format conversations into a readable string
    const conversationText = conversations
      .map(conv => `[${conv.timestamp}] ${conv.username}: ${conv.transcription}`)
      .join('\n');

    console.log(`\n=== Starting Code Generation ===`);
    console.log(`Repo: ${repoUrl}`);
    console.log(`Branch: ${branch}`);
    console.log(`Conversations: ${conversations.length} messages\n`);

    // Define tools for the agent
    const tools = [
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

    // Create the initial prompt
    const systemPrompt = `You are an AI code generation agent. Based on the conversation transcript provided, analyze the requirements and generate code changes.

Your task:
1. Analyze the conversation to understand what code changes are needed
2. Use the available tools to explore the repository structure and relevant files:
   - First, call list_repo_files to see all files in the repository
   - Then, call get_file_content for each file you need to read or modify
3. After exploring the codebase, generate code changes

CRITICAL: You MUST output your final response in valid JSON format with this exact structure:
{
  "summary": "A brief summary of the changes made",
  "files": [
    {
      "filename": "path/to/file.js",
      "new_content": "complete file content with changes"
    }
  ]
}

Important:
- Only include files that need to be changed or created
- Provide the complete content for each file (not just diffs)
- Make sure the code is syntactically correct and follows best practices
- The filename must be relative to the repository root (as returned by list_repo_files)
- The repository URL is: ${repoUrl}
- The branch is: ${branch}
- When you are ready to output the final result, respond with ONLY the JSON object, no additional text before or after`;

    const userPrompt = `Based on the following conversation, generate the necessary code changes:\n\n${conversationText}`;

    // Start the conversation with the agent
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    let maxIterations = 10;
    let iteration = 0;

    while (iteration < maxIterations) {
      const response = await openaiClient.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: messages,
        tools: tools,
        tool_choice: iteration === 0 ? 'auto' : 'auto',
        temperature: 0.7,
        response_format: { type: 'json_object' } // Enable JSON mode for structured output
      });

      const message = response.choices[0].message;
      messages.push(message);

      // If the agent wants to use tools, execute them
      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            console.warn('Failed to parse tool arguments, using empty object:', e);
          }

          let toolResult;
          try {
            if (toolName === 'list_repo_files') {
              const files = await listRepoFiles(repoUrl, branch);
              toolResult = { files };
            } else if (toolName === 'get_file_content') {
              const content = await getFileContent(repoUrl, branch, toolArgs.filePath);
              toolResult = { content };
            } else {
              toolResult = { error: `Unknown tool: ${toolName}` };
            }
          } catch (error) {
            toolResult = { error: error.message };
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }
      } else {
        // Agent has finished and provided the final answer
        const content = message.content;
        try {
          // Parse JSON response (with JSON mode, content should be valid JSON)
          let result;
          if (typeof content === 'string') {
            // Try to extract JSON if wrapped in markdown or other text
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              result = JSON.parse(jsonMatch[0]);
            } else {
              result = JSON.parse(content);
            }
          } else {
            result = content;
          }

          // Validate result structure
          if (!result.summary || !Array.isArray(result.files)) {
            throw new Error('Invalid response format: missing summary or files array');
          }

          console.log('\n=== Code Generation Complete ===');
          console.log(JSON.stringify(result, null, 2));
          return result;
        } catch (error) {
          console.error('Error parsing agent response:', error);
          console.error('Raw content:', content);
          // If JSON parsing fails, try to extract any meaningful information
          return {
            summary: typeof content === 'string' ? content.substring(0, 200) : 'Code generation completed',
            files: []
          };
        }
      }

      iteration++;
    }

    // If we hit max iterations, return a message
    throw new Error('Agent exceeded maximum iterations');
  } catch (error) {
    console.error('Error in code generation:', error);
    throw error;
  }
}

