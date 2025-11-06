/**
 * Register a new repository
 * POST /api/repos/register
 * Body: { repoUrl: string, userName: string }
 */
export async function registerRepo(req, res) {
  console.log('registerRepo', req.body);
}

/**
 * Connect a user to a repository
 * POST /api/repos/connect
 * Body: { repoUrl: string, userName: string, branch?: string }
 */
export async function connectUser(req, res) {
  try {
    const { repoUrl, userName, branch } = req.body;

    // Validate required fields
    if (!repoUrl || !userName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'repoUrl and userName are required'
      });
    }

    // Use repoUrl as repoId (could be normalized in the future)
    const repoId = repoUrl;
    const branchName = branch || 'main';

    console.log(`User ${userName} connecting to repo ${repoId} on branch ${branchName}`);

    // Return success response with connection info
    res.json({
      repoId: repoId,
      userName: userName,
      branch: branchName
    });
  } catch (error) {
    console.error('Error in connectUser:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
