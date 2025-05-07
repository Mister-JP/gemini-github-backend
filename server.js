require('dotenv').config();
const express = require('express');
const { Octokit } = require("@octokit/rest");
const cors = require('cors');
const path = require('path');

const loadedPAT = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const PORT_SERVER = process.env.PORT || 8090;

console.log(`DEBUG: Loaded GITHUB_PERSONAL_ACCESS_TOKEN: "${loadedPAT ? 'Exists' : 'MISSING!!!'}"`);

if (!loadedPAT) {
    console.error("--------------------------------------------------------------------");
    console.error("FATAL ERROR: GITHUB_PERSONAL_ACCESS_TOKEN is NOT loaded!");
    console.error("1. Ensure '.env' file exists in the project root.");
    console.error("2. Ensure it contains: GITHUB_PERSONAL_ACCESS_TOKEN=ghp_yourtokenhere");
    console.error("--------------------------------------------------------------------");
    process.exit(1);
}

const GITHUB_PAT = loadedPAT;
const app = express();

app.use(cors()); // Enable CORS for API requests
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const octokit = new Octokit({ auth: GITHUB_PAT });

/**
 * Helper function to build a nested tree structure from a flat list of GitHub tree items.
 * @param {Array<object>} treeItems - Flat array of items from GitHub's git.getTree API.
 * @param {string} repoFullName - The full name of the repository (e.g., "owner/repo").
 * @returns {Array<object>} A nested tree structure.
 */
function buildNestedTree(treeItems, repoFullName) {
    const tree = [];
    const map = {}; // Stores all nodes by their path for quick lookup

    // First pass: Create all nodes and map them by path.
    // This handles cases where files/dirs might not be perfectly ordered from the API.
    for (const item of treeItems) {
        const name = item.path.split('/').pop();
        map[item.path] = {
            name: name,
            path: item.path,
            type: item.type === 'tree' ? 'dir' : 'file', // 'tree' is a directory, 'blob' is a file
            sha: item.sha,
            children: item.type === 'tree' ? [] : undefined, // Directories have children
        };
    }

    // Second pass: Populate children arrays to build the hierarchy.
    for (const itemPath in map) {
        const node = map[itemPath];
        const pathParts = itemPath.split('/');

        if (pathParts.length > 1) {
            const parentPath = pathParts.slice(0, -1).join('/');
            if (map[parentPath] && map[parentPath].type === 'dir') {
                map[parentPath].children.push(node);
            } else {
                // This might happen if a parent directory wasn't explicitly in treeItems
                // (e.g. empty dirs not always shown in recursive tree unless they contain something)
                // Or, it could be an orphaned item if the tree data is unusual.
                // For this tool's purpose, we primarily rely on GitHub's recursive tree.
                // If a parent isn't in the map, it implies it's a top-level item or an issue with data.
                // Safely assume it is top-level if parent is not in map, to avoid errors.
                // However, correctly formed trees from `git.getTree` should ensure parents exist.
                 if (!map[parentPath]) tree.push(node); // Add to root if parent is not found
            }
        } else {
            // Top-level item
            tree.push(node);
        }
    }
    
    // Recursive sort function
    function sortNodes(nodes) {
        nodes.sort((a, b) => {
            if (a.type === 'dir' && b.type !== 'dir') return -1;
            if (a.type !== 'dir' && b.type === 'dir') return 1;
            return a.name.localeCompare(b.name);
        });
        nodes.forEach(node => {
            if (node.type === 'dir' && node.children) {
                sortNodes(node.children);
            }
        });
    }

    sortNodes(tree);
    return tree;
}


// API Endpoint to list user's repositories (owned by the PAT user)
app.get('/api/github/repos', async (req, res) => {
    try {
        console.log("API: Fetching repositories (type: owner)...");
        const { data: repos } = await octokit.repos.listForAuthenticatedUser({
            type: 'owner', // Lists repositories owned by the authenticated user.
            sort: 'updated', // Sorts by the last update time.
            per_page: 100, // Fetches up to 100 repositories.
        });
        const simplifiedRepos = repos.map(repo => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            private: repo.private,
            description: repo.description,
            url: repo.html_url
        }));
        console.log(`API: Found ${simplifiedRepos.length} repositories.`);
        res.json(simplifiedRepos);
    } catch (error) {
        console.error('API Error fetching repositories:', error.message, error.status);
        res.status(error.status || 500).json({
            error: 'Failed to fetch repositories from GitHub',
            details: error.message
        });
    }
});

// API Endpoint to get the full file tree structure of a repository
app.get('/api/github/repo-contents', async (req, res) => {
    const { owner, repo } = req.query;
    if (!owner || !repo) {
        return res.status(400).json({ error: 'Owner and repo query parameters are required.' });
    }
    try {
        console.log(`API: Fetching repository details for ${owner}/${repo} to get default branch...`);
        const { data: repoData } = await octokit.repos.get({ owner, repo });
        const defaultBranch = repoData.default_branch;

        if (!defaultBranch) {
            throw new Error(`Could not determine default branch for ${owner}/${repo}.`);
        }
        console.log(`API: Default branch is "${defaultBranch}". Fetching tree for ${owner}/${repo}...`);

        const { data: treeData } = await octokit.git.getTree({
            owner,
            repo,
            tree_sha: defaultBranch, // SHA of the default branch's root tree
            recursive: '1', // Flag to get all tree items recursively. Use '1' as per Octokit docs for older versions or ensure boolean true works.
        });

        if (treeData.truncated) {
            console.warn(`API WARNING: Tree data for ${owner}/${repo} was truncated by GitHub. Some files/directories may be missing.`);
        }

        const nestedTree = buildNestedTree(treeData.tree, `${owner}/${repo}`);
        console.log(`API: Successfully fetched and structured tree for ${owner}/${repo}. Root items: ${nestedTree.length}`);
        res.json(nestedTree); // Send the hierarchically structured tree

    } catch (error) {
        console.error(`API Error fetching repo contents for ${owner}/${repo}:`, error.message, error.status);
        res.status(error.status || 500).json({
            error: 'Failed to fetch repository contents or structure',
            details: error.message
        });
    }
});


// API Endpoint to get raw content of a specific file
app.get('/api/github/file-raw', async (req, res) => {
    const { owner, repo, path: filePath } = req.query;
    if (!owner || !repo || !filePath) {
        return res.status(400).json({ error: 'Owner, repo, and path query parameters are required.' });
    }
    try {
        console.log(`API: Fetching raw file content for ${owner}/${repo}/${filePath}`);
        const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo,
            path: filePath,
            mediaType: { format: 'raw' } // Ensures raw text content is fetched.
        });
        console.log(`API: Successfully fetched raw content for ${filePath}.`);
        res.type('text/plain').send(fileData);
    } catch (error) {
        console.error(`API Error fetching raw file content for ${owner}/${repo}/${filePath}:`, error.message, error.status);
        res.status(error.status || 500).json({
            error: 'Failed to fetch raw file content',
            details: error.message
        });
    }
});

// Catch-all to serve index.html for any non-API or non-static file requests
// This is useful for single-page applications (SPAs)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT_SERVER, () => {
    console.log(`Server (API & Frontend) is running on http://localhost:${PORT_SERVER}`);
});