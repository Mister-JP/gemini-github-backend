# Local GitHub Repository Explorer & Text Combiner

## Overview

The Local GitHub Repository Explorer is a web-based application designed to facilitate the browsing of your GitHub repositories and the consolidation of selected file contents into a single, combined text output. This tool is particularly useful for developers, technical writers, or anyone needing to quickly aggregate code, documentation, or other text-based files from repositories for review, analysis, or input into other systems (e.g., LLMs for contextual understanding).

It operates with a Node.js backend that securely interacts with the GitHub API using your Personal Access Token (PAT), and a vanilla JavaScript frontend for a responsive user experience.

## Key Features

*   **Repository Listing:** Loads and displays a list of your owned GitHub repositories (both public and private).
*   **Interactive File Tree:** Renders a navigable tree structure for the selected repository's contents.
    *   Displays directories and files clearly.
    *   Supports recursive fetching to display the entire repository structure.
*   **File Selection:** Allows users to select multiple files from the tree.
*   **Bulk Selection Controls:** Includes "Select All Files in Tree" and "Deselect All Files in Tree" for convenience.
*   **Combined Text Generation:**
    *   Fetches the raw content of all selected files.
    *   Formats the output with clear delimiters and path information for each file.
    *   Provides real-time progress updates during file fetching.
*   **Copy to Clipboard:** Easily copy the entire combined text output with a single click.
*   **Secure GitHub API Interaction:** Uses a Personal Access Token (PAT) for GitHub API authentication, managed via a local `.env` file.
*   **User-Friendly Interface:** Clean, card-based design for intuitive navigation and operation.
*   **Error Handling:** Provides feedback for common issues such as PAT misconfiguration or API errors.

## Tech Stack

*   **Backend:**
    *   Node.js
    *   Express.js (Web framework)
    *   `@octokit/rest` (GitHub API client)
    *   `dotenv` (Environment variable management)
    *   `cors` (Cross-Origin Resource Sharing)
*   **Frontend:**
    *   HTML5
    *   CSS3
    *   Vanilla JavaScript (ES Modules)
*   **Package Manager:** npm

## Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js:** (LTS version recommended, e.g., v18.x or v20.x). You can download it from [nodejs.org](https://nodejs.org/).
*   **npm:** (Usually comes with Node.js).
*   **Git:** (For cloning the repository).
*   **GitHub Personal Access Token (PAT):**
    *   You need a PAT with the appropriate permissions to read your repositories and their contents.
    *   **Required scopes:**
        *   `repo` (Full control of private repositories) - This grants access to code, commit statuses, etc. If you only need to read public repositories, `public_repo` might suffice, but for full functionality including private repos, `repo` is generally needed.
    *   Create a new PAT [here](https://github.com/settings/tokens/new).
    *   **Important:** Treat your PAT like a password. Do not commit it to your repository.

## Setup and Installation

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/Mister-JP/gemini-github-backend.git
    cd gemini-github-backend
    ```

2.  **Install Dependencies:**
    Navigate to the project directory and install the necessary Node.js packages:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root of the project directory. This file will store your GitHub PAT.
    ```
    touch .env
    ```
    Add your GitHub Personal Access Token to the `.env` file:
    ```plaintext
    # .env
    GITHUB_PERSONAL_ACCESS_TOKEN=ghp_YourActualTokenHere
    PORT=8090 # Optional: Define a custom port for the server (defaults to 8090)
    ```
    Replace `ghp_YourActualTokenHere` with your actual GitHub PAT.

    **Note:** The `.gitignore` file is already configured to prevent the `.env` file from being committed to Git.

## Running the Application

1.  **Start the Server:**
    Once the dependencies are installed and the `.env` file is configured, start the server using:
    ```bash
    npm start
    ```
    You should see output in your terminal indicating that the server is running, typically:
    ```
    DEBUG: Loaded GITHUB_PERSONAL_ACCESS_TOKEN: "Exists"
    Server (API & Frontend) is running on http://localhost:8090
    ```
    If the `GITHUB_PERSONAL_ACCESS_TOKEN` is missing, the server will output an error message and exit.

2.  **Access the Application:**
    Open your web browser and navigate to:
    [http://localhost:8090](http://localhost:8090) (or the custom port you configured).

## How to Use

1.  **Load Repositories:**
    *   Click the "**Load My Repositories**" button.
    *   The application will fetch and display a list of repositories owned by the authenticated user (associated with the PAT). Repositories will be listed with their full name and visibility (Public/Private).

2.  **Select a Repository:**
    *   Click on any repository name from the list.
    *   The file tree view for that repository will appear below.

3.  **Navigate and Select Files:**
    *   The file tree will display directories and files. Directories are indicated by a folder icon and bold text.
    *   Directories can be expanded to show their contents (this happens automatically as the entire tree is fetched).
    *   Check the checkboxes next to the files you want to include in the combined text output.
    *   Use the "**Select All Files in Tree**" and "**Deselect All Files in Tree**" buttons for quick selections/deselections within the current view.

4.  **Generate Combined Text:**
    *   Once you have selected the desired files, click the "**Generate Combined Text**" button.
    *   The "Combined Text Output" section will appear.
    *   The textarea will initially show "Generating combined text..." and provide progress updates as it fetches each selected file's content.
    *   After all files are fetched, the textarea will be populated with the combined text. Each file's content is clearly demarcated with its path.

    **Output Format Example:**
    ```
    Repository: Mister-JP/gemini-github-backend

    Selected files for inclusion (3 total):
    - public/script.js
    - server.js
    - README.md
    ---

    Path: public/script.js
    --- Start of file: public/script.js ---
    // content of script.js
    --- End of file: public/script.js ---

    Path: server.js
    --- Start of file: server.js ---
    // content of server.js
    --- End of file: server.js ---

    Path: README.md
    --- Start of file: README.md ---
    // content of README.md
    --- End of file: README.md ---
    ```

5.  **Copy Combined Text:**
    *   Click the "**Copy All Text**" button below the textarea.
    *   The combined text will be copied to your clipboard. A confirmation alert will appear.

## API Endpoints

The backend server exposes the following API endpoints, which are consumed by the frontend:

*   `GET /api/github/repos`
    *   Description: Fetches a list of repositories for the authenticated user.
    *   Parameters: None.
    *   Response: JSON array of simplified repository objects.

*   `GET /api/github/repo-contents`
    *   Description: Fetches the entire hierarchical file tree structure for the specified repository. The server now handles recursive fetching and tree construction for improved efficiency.
    *   Query Parameters:
        *   `owner` (string, required): The owner of the repository.
        *   `repo` (string, required): The name of the repository.
    *   Response: JSON array representing the root items of the repository's file tree. Each item an object with `name`, `path`, `type` ('file' or 'dir'), `sha`, and a `children` array for directories.
    *   Note: If GitHub reports that the tree data was truncated (for extremely large repositories), some files or directories might be missing.

*   `GET /api/github/file-raw`
    *   Description: Fetches the raw text content of a specific file.
    *   Query Parameters:
        *   `owner` (string, required): The owner of the repository.
        *   `repo` (string, required): The name of the repository.
        *   `path` (string, required): The full path to the file.
    *   Response: Plain text content of the file.
