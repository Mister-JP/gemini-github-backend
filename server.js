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

// API Endpoint to list user's repositories (owned by the PAT user)
app.get('/api/github/repos', async (req, res) => {
    try {
        console.log("API: Fetching repositories (type: owner)...");
        const { data: repos } = await octokit.repos.listForAuthenticatedUser({
            type: 'owner',
            sort: 'updated',
            per_page: 100,
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
        console.error('API Error fetching repositories:', error.message);
        res.status(error.status || 500).json({
            error: 'Failed to fetch repositories from GitHub',
            details: error.message
        });
    }
});

// API Endpoint to get contents of a directory or a single file's metadata
app.get('/api/github/repo-contents', async (req, res) => {
    const { owner, repo, path: repoPath = '' } = req.query;
    if (!owner || !repo) {
        return res.status(400).json({ error: 'Owner and repo query parameters are required.' });
    }
    try {
        console.log(`API: Fetching contents for ${owner}/${repo} at path: '${repoPath}'`);
        const { data: contents } = await octokit.repos.getContent({
            owner,
            repo,
            path: repoPath,
        });
        console.log(`API: Found ${Array.isArray(contents) ? contents.length : 1} item(s) at path '${repoPath}'.`);
        res.json(contents);
    } catch (error) {
        console.error(`API Error fetching repo contents for ${owner}/${repo}/${repoPath}:`, error.message);
        res.status(error.status || 500).json({
            error: 'Failed to fetch repository contents',
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
            mediaType: { format: 'raw' }
        });
        console.log(`API: Successfully fetched raw content for ${filePath}.`);
        res.type('text/plain').send(fileData);
    } catch (error) {
        console.error(`API Error fetching raw file content for ${owner}/${repo}/${filePath}:`, error.message);
        res.status(error.status || 500).json({
            error: 'Failed to fetch raw file content',
            details: error.message
        });
    }
});

// Catch-all to serve index.html for any non-API or non-static file requests
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT_SERVER, () => {
    console.log(`Server (API & Frontend) is running on http://localhost:${PORT_SERVER}`);
});