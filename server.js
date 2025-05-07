// server.js

require('dotenv').config(); // Make sure this is very early
const express = require('express');
const { Octokit } = require("@octokit/rest");
const cors = require('cors');

// --- Start of a more explicit check ---
const loadedPAT = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
console.log(`DEBUG: Value of GITHUB_PERSONAL_ACCESS_TOKEN from .env is: "${loadedPAT}"`); // Will show undefined if not loaded

if (!loadedPAT) {
    console.error("--------------------------------------------------------------------");
    console.error("FATAL ERROR: GITHUB_PERSONAL_ACCESS_TOKEN is NOT loaded!");
    console.error("Please check the following:");
    console.error("1. Is there a file named EXACTLY '.env' in the project root?");
    console.error("2. Does the '.env' file contain a line like: GITHUB_PERSONAL_ACCESS_TOKEN=ghp_yourtokenhere ?");
    console.error("3. Are there any typos in the variable name inside '.env'?");
    console.error("--------------------------------------------------------------------");
    process.exit(1); // Exit the process
}
// --- End of a more explicit check ---

const GITHUB_PAT = loadedPAT; // Use the variable we checked

const app = express();
const port = process.env.PORT || 8085;

app.use(cors());
app.use(express.json());

// This line should now be safe because we checked GITHUB_PAT above
const octokit = new Octokit({ auth: GITHUB_PAT });

// ... (rest of your route definitions: app.get('/api/github/repos', etc.)) ...
// Make sure they are all below the octokit initialization

app.get('/api/github/repos', async (req, res) => {
    try {
        console.log("Fetching repositories for authenticated user...");
        const { data: repos } = await octokit.repos.listForAuthenticatedUser({
            type: 'private', 
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

        console.log(`Found ${simplifiedRepos.length} repositories.`);
        res.json(simplifiedRepos);

    } catch (error) {
        console.error('Error fetching repositories:', error.message);
        if (error.status) {
            res.status(error.status).json({ error: 'Failed to fetch repositories from GitHub', details: error.message });
        } else {
            res.status(500).json({ error: 'An unexpected error occurred while fetching repositories', details: error.message });
        }
    }
});


app.get('/api/github/repo-contents', async (req, res) => {
    const { owner, repo, path = '' } = req.query; 

    if (!owner || !repo) {
        return res.status(400).json({ error: 'Owner and repo query parameters are required.' });
    }

    try {
        console.log(`Fetching contents for ${owner}/${repo} at path: '${path}'`);
        const { data: contents } = await octokit.repos.getContent({
            owner,
            repo,
            path,
        });
        
        console.log(`Found ${Array.isArray(contents) ? contents.length : 1} item(s) at path '${path}'.`);
        res.json(contents);

    } catch (error) {
        console.error(`Error fetching repo contents for ${owner}/${repo}/${path}:`, error.message);
        if (error.status === 404) {
            res.status(404).json({ error: 'File or directory not found at the specified path.', details: error.message });
        } else if (error.status) {
            res.status(error.status).json({ error: 'Failed to fetch repository contents from GitHub', details: error.message });
        } else {
            res.status(500).json({ error: 'An unexpected error occurred while fetching repository contents', details: error.message });
        }
    }
});
app.get('/api/github/file-raw', async (req, res) => {
    const { owner, repo, path } = req.query;

    if (!owner || !repo || !path) {
        return res.status(400).json({ error: 'Owner, repo, and path query parameters are required for fetching raw file content.' });
    }

    try {
        console.log(`Fetching raw file content for ${owner}/${repo}/${path}`);
        const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo,
            path,
            mediaType: {
                format: 'raw' 
            }
        });

        console.log(`Successfully fetched raw content for ${path}. Content length: ${typeof fileData === 'string' ? fileData.length : 'N/A'}`);
        res.type('text/plain'); 
        res.send(fileData);

    } catch (error) {
        console.error(`Error fetching raw file content for ${owner}/${repo}/${path}:`, error.message);
        if (error.status === 404) {
            res.status(404).json({ error: 'File not found.', details: error.message });
        } else if (error.status) {
            res.status(error.status).json({ error: 'Failed to fetch raw file content from GitHub', details: error.message });
        } else {
            res.status(500).json({ error: 'An unexpected error occurred while fetching raw file content', details: error.message });
        }
    }
});


app.listen(port, () => {
    console.log(`Backend server is running on http://localhost:${port}`);
    // Removed the "Ensure your GITHUB_PERSONAL_ACCESS_TOKEN is correctly set" message from here
    // as the check is now done earlier and more explicitly.
});