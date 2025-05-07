// public/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const loadReposButton = document.getElementById('loadMyReposButton');
    const repoListUl = document.getElementById('repoList');

    const fileTreeViewSection = document.getElementById('fileTreeViewSection');
    const selectedRepoNameH2 = document.getElementById('selectedRepoName');
    const fileTreeDiv = document.getElementById('fileTree');
    const generateCombinedTextButton = document.getElementById('generateCombinedTextButton');

    const selectAllInTreeButton = document.getElementById('selectAllInTreeButton');
    const deselectAllInTreeButton = document.getElementById('deselectAllInTreeButton');

    const combinedOutputSection = document.getElementById('combinedOutputSection');
    const combinedOutputTextarea = document.getElementById('combinedOutputTextarea');
    const copyCombinedTextButton = document.getElementById('copyCombinedTextButton');

    // --- State Variables ---
    let currentSelectedRepo = { owner: null, name: null }; // Stores the currently selected repository's owner and name
    let selectedFilePathsForOutput = new Set(); // Stores the paths of files selected by the user for the combined output

    // --- 1. Load Repositories ---
    if (loadReposButton) {
        loadReposButton.addEventListener('click', async () => {
            repoListUl.innerHTML = '<li>Loading repositories...</li>';
            fileTreeViewSection.style.display = 'none';
            combinedOutputSection.style.display = 'none';
            try {
                const response = await fetch('/api/github/repos');
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(`Backend Error (${response.status}): ${errData.details || errData.error || response.statusText}`);
                }
                const repos = await response.json();
                renderRepoList(repos);
            } catch (error) {
                console.error('Error fetching repositories:', error);
                repoListUl.innerHTML = `<li>Error: ${error.message}</li>`;
                alert(`Could not load repositories. Is the server running and PAT correct?\n${error.message}`);
            }
        });
    }

    /**
     * Renders the list of repositories in the UI.
     * @param {Array<object>} repos - Array of repository objects from the backend.
     */
    function renderRepoList(repos) {
        repoListUl.innerHTML = ''; // Clear previous list
        if (!repos || repos.length === 0) {
            repoListUl.innerHTML = '<li>No repositories found or PAT lacks permissions.</li>';
            return;
        }
        repos.forEach(repo => {
            const li = document.createElement('li');
            li.textContent = `${repo.full_name} ${repo.private ? '(Private)' : '(Public)'}`;
            li.title = repo.description || 'No description available';
            li.addEventListener('click', () => {
                currentSelectedRepo.owner = repo.full_name.split('/')[0];
                currentSelectedRepo.name = repo.name;
                selectedRepoNameH2.textContent = `Files in: ${repo.full_name}`;
                fileTreeViewSection.style.display = 'block';
                combinedOutputSection.style.display = 'none'; // Hide previous output
                selectedFilePathsForOutput.clear(); // Clear selections from previous repo
                fetchAndRenderFileTree(currentSelectedRepo.owner, currentSelectedRepo.name);
            });
            repoListUl.appendChild(li);
        });
    }

    // --- 2. Fetch and Render File Tree ---
    /**
     * Fetches the complete file tree structure from the backend and initiates rendering.
     * @param {string} owner - The owner of the repository.
     * @param {string} repoName - The name of the repository.
     */
    async function fetchAndRenderFileTree(owner, repoName) {
        fileTreeDiv.innerHTML = '<p>Loading file tree...</p>';
        generateCombinedTextButton.disabled = true;
        if (selectAllInTreeButton) selectAllInTreeButton.disabled = true;
        if (deselectAllInTreeButton) deselectAllInTreeButton.disabled = true;

        try {
            // Fetch the entire tree structure (server now handles recursion)
            const response = await fetch(`/api/github/repo-contents?owner=${owner}&repo=${repoName}`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(`Failed to fetch repository tree: ${errData.details || response.statusText}`);
            }
            const treeItems = await response.json(); // This is now the nested tree structure

            // Create a root node object to pass to renderFileTreeUI, similar to previous structure
            const treeRootNode = { name: repoName, type: 'dir', path: '', children: treeItems };
            renderFileTreeUI(treeRootNode, fileTreeDiv, true); // Render the tree

            generateCombinedTextButton.disabled = false;
            if (selectAllInTreeButton) selectAllInTreeButton.disabled = false;
            if (deselectAllInTreeButton) deselectAllInTreeButton.disabled = false;
        } catch (error) {
            console.error('Error fetching or rendering repository file tree:', error);
            fileTreeDiv.innerHTML = `<p>Error loading file tree: ${error.message}</p>`;
        }
    }

    /**
     * Renders the file tree UI recursively.
     * @param {object} node - The current node in the tree to render. Expected to have `name`, `type`, `path`, and `children` (if 'dir').
     * @param {HTMLElement} parentElement - The HTML element to append the rendered tree to.
     * @param {boolean} [isRoot=false] - Flag to indicate if this is the root call, used for clearing the container.
     */
    function renderFileTreeUI(node, parentElement, isRoot = false) {
        if (isRoot) {
            parentElement.innerHTML = ''; // Clear previous tree for the root call
        }

        // The `node` itself is not rendered if it's the conceptual root passed in.
        // Its children are the actual top-level items of the repository.
        const itemsToRender = isRoot ? node.children : node.children || [];

        if (isRoot && itemsToRender.length === 0) {
            parentElement.innerHTML = '<p>This repository or directory is empty, or the tree could not be fully loaded.</p>';
            return;
        }
        
        const ul = document.createElement('ul');
        if (isRoot) { // For root, padding might be different or already handled by parentElement
            ul.style.paddingLeft = '0px'; 
        }


        itemsToRender.forEach(childNode => {
            const li = document.createElement('li');
            li.classList.add('tree-node', `tree-node-${childNode.type}`);

            const label = document.createElement('label');
            label.classList.add('node-label');

            if (childNode.type === 'file') {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.filePath = childNode.path;
                checkbox.dataset.fileName = childNode.name;
                // Use SHA or a sanitized path for unique ID. SHA is more robust if available.
                checkbox.id = `cb-${childNode.sha || childNode.path.replace(/[^a-zA-Z0-9-_]/g, '-')}`;
                label.htmlFor = checkbox.id;

                checkbox.checked = selectedFilePathsForOutput.has(childNode.path); // Restore selection

                checkbox.addEventListener('change', (event) => {
                    if (event.target.checked) {
                        selectedFilePathsForOutput.add(childNode.path);
                    } else {
                        selectedFilePathsForOutput.delete(childNode.path);
                    }
                });
                label.appendChild(checkbox);
            }
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = childNode.name;
            label.appendChild(nameSpan);
            
            li.appendChild(label);

            // If it's a directory and has children, recursively render them
            if (childNode.type === 'dir' && childNode.children && childNode.children.length > 0) {
                renderFileTreeUI(childNode, li, false); // Pass the childNode, which contains its own children
            }
            ul.appendChild(li);
        });

        if (ul.hasChildNodes()) { 
            parentElement.appendChild(ul);
        }
    }

    // --- 3. Select/Deselect All Files in Tree ---
    /**
     * Sets the checked state for all file checkboxes currently rendered in the file tree.
     * @param {boolean} isChecked - True to select all, false to deselect all.
     */
    function setAllFileCheckboxesInTree(isChecked) {
        const fileCheckboxes = fileTreeDiv.querySelectorAll('input[type="checkbox"][data-file-path]');
        if (fileCheckboxes.length === 0 && isChecked) {
            alert("No files found in the current tree view to select.");
            return;
        }
        
        fileCheckboxes.forEach(checkbox => {
            // Only change if needed, and update the master set
            if (checkbox.checked !== isChecked) {
                checkbox.checked = isChecked;
            }
            const filePath = checkbox.dataset.filePath;
            if (isChecked) {
                selectedFilePathsForOutput.add(filePath);
            } else {
                selectedFilePathsForOutput.delete(filePath);
            }
        });
    }

    if (selectAllInTreeButton) {
        selectAllInTreeButton.addEventListener('click', () => setAllFileCheckboxesInTree(true));
    }

    if (deselectAllInTreeButton) {
        deselectAllInTreeButton.addEventListener('click', () => setAllFileCheckboxesInTree(false));
    }

    // --- 4. Generate and Copy Combined Text ---
    if (generateCombinedTextButton) {
        generateCombinedTextButton.addEventListener('click', async () => {
            if (selectedFilePathsForOutput.size === 0) {
                alert("Please select at least one file from the tree.");
                return;
            }

            combinedOutputSection.style.display = 'block';
            combinedOutputTextarea.value = "Generating combined text...\nFetching file contents...\n\n";
            generateCombinedTextButton.disabled = true; // Disable button during generation
            if (copyCombinedTextButton) copyCombinedTextButton.disabled = true;

            let combinedText = `Repository: ${currentSelectedRepo.owner}/${currentSelectedRepo.name}\n\n`;
            combinedText += `Selected files for inclusion (${selectedFilePathsForOutput.size} total):\n`;
            // Create a sorted array from the Set for ordered display
            const sortedFilePaths = Array.from(selectedFilePathsForOutput).sort();
            sortedFilePaths.forEach(path => {
                combinedText += `- ${path}\n`;
            });
            combinedText += "\n---\n\n";

            let filesProcessedCount = 0;
            // Iterate over the sorted array for fetching
            for (const filePath of sortedFilePaths) {
                filesProcessedCount++;
                const progressMessage = `Fetching (${filesProcessedCount}/${selectedFilePathsForOutput.size}): ${filePath}...\n`;
                combinedOutputTextarea.value += progressMessage;

                try {
                    const response = await fetch(`/api/github/file-raw?owner=${currentSelectedRepo.owner}&repo=${currentSelectedRepo.name}&path=${encodeURIComponent(filePath)}`);
                    if (!response.ok) {
                        const errorText = await response.text().catch(() => "Could not read error details from server.");
                        combinedText += `Error fetching file: ${filePath}\nStatus: ${response.status}\nDetails: ${errorText}\n\n`;
                        combinedOutputTextarea.value += `Error fetching ${filePath}!\n`;
                        continue; // Skip to next file
                    }
                    const fileContent = await response.text();
                    combinedText += `Path: ${filePath}\n`;
                    combinedText += `--- Start of file: ${filePath} ---\n`;
                    combinedText += fileContent;
                    combinedText += `\n--- End of file: ${filePath} ---\n\n`;
                    combinedOutputTextarea.value += `Done: ${filePath}\n`;

                } catch (error) {
                    combinedText += `Network error fetching file: ${filePath}\n${error.message}\n\n`;
                    combinedOutputTextarea.value += `Network error for ${filePath}!\n`;
                }
            }
            combinedOutputTextarea.value = combinedText.trim(); // Set the final combined text
            generateCombinedTextButton.disabled = false; // Re-enable button
            if (copyCombinedTextButton) copyCombinedTextButton.disabled = false;
            alert("Combined text generated!");
        });
    }

    if (copyCombinedTextButton) {
        copyCombinedTextButton.addEventListener('click', () => {
            if (!combinedOutputTextarea.value) {
                alert("Nothing to copy.");
                return;
            }
            combinedOutputTextarea.select(); // Select the text
            try {
                // Modern asynchronous clipboard API
                navigator.clipboard.writeText(combinedOutputTextarea.value)
                    .then(() => {
                        alert('Combined text copied to clipboard!');
                    })
                    .catch(err => {
                        console.error('Failed to copy text using navigator.clipboard: ', err);
                        legacyCopyText(); // Fallback for older browsers or if API fails
                    });
            } catch (err) {
                console.error('Error in copy operation (navigator.clipboard likely not supported): ', err);
                legacyCopyText();
            }
            // Deselect text after attempting to copy to avoid user confusion
            window.getSelection()?.removeAllRanges();
        });
    }

    /**
     * Fallback method to copy text using the deprecated document.execCommand.
     */
    function legacyCopyText() {
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                alert('Combined text copied to clipboard! (using fallback)');
            } else {
                alert('Fallback copy failed. Please copy manually.');
                console.warn('document.execCommand("copy") was unsuccessful.');
            }
        } catch (err) {
            console.error('Fallback copy method (document.execCommand) failed:', err);
            alert('Failed to copy text automatically. Please copy manually.');
        }
    }

}); // End of DOMContentLoaded