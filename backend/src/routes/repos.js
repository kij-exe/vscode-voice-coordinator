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
  console.log('connectUser', req.body);
}
