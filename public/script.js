// public/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const loadReposButton = document.getElementById('loadMyReposButton');
    const repoListUl = document.getElementById('repoList');

    const fileTreeViewSection = document.getElementById('fileTreeViewSection');
    const selectedRepoNameH2 = document.getElementById('selectedRepoName');
    const fileTreeDiv = document.getElementById('fileTree');
    const generateCombinedTextButton = document.getElementById('generateCombinedTextButton');

    // New buttons for select/deselect all
    const selectAllInTreeButton = document.getElementById('selectAllInTreeButton');
    const deselectAllInTreeButton = document.getElementById('deselectAllInTreeButton');

    const combinedOutputSection = document.getElementById('combinedOutputSection');
    const combinedOutputTextarea = document.getElementById('combinedOutputTextarea');
    const copyCombinedTextButton = document.getElementById('copyCombinedTextButton');

    // --- State Variables ---
    let currentSelectedRepo = { owner: null, name: null }; // Stores the currently selected repository's owner and name
    let selectedFilePathsForOutput = new Set(); // Stores the paths of files selected by the user

    // --- 1. Load Repositories ---
    if (loadReposButton) {
        loadReposButton.addEventListener('click', async () => {
            repoListUl.innerHTML = '<li>Loading repositories...</li>';
            fileTreeViewSection.style.display = 'none';
            combinedOutputSection.style.display = 'none';
            try {
                const response = await fetch('/api/github/repos');
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({})); // Try to parse JSON error, fallback to empty object
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

    function renderRepoList(repos) {
        repoListUl.innerHTML = ''; // Clear previous list
        if (repos.length === 0) {
            repoListUl.innerHTML = '<li>No repositories found or PAT lacks permissions.</li>';
            return;
        }
        repos.forEach(repo => {
            const li = document.createElement('li');
            li.textContent = `${repo.full_name} ${repo.private ? '(Private)' : '(Public)'}`;
            li.title = repo.description || 'No description';
            li.addEventListener('click', () => {
                currentSelectedRepo.owner = repo.full_name.split('/')[0];
                currentSelectedRepo.name = repo.name;
                selectedRepoNameH2.textContent = `Files in: ${repo.full_name}`;
                fileTreeViewSection.style.display = 'block';
                combinedOutputSection.style.display = 'none';
                selectedFilePathsForOutput.clear(); // Clear previous selections when a new repo is chosen
                fetchAndRenderFileTree(currentSelectedRepo.owner, currentSelectedRepo.name);
            });
            repoListUl.appendChild(li);
        });
    }

    // --- 2. Fetch and Render File Tree ---
    async function fetchAndRenderFileTree(owner, repoName) {
        fileTreeDiv.innerHTML = '<p>Loading file tree...</p>';
        generateCombinedTextButton.disabled = true;
        if (selectAllInTreeButton) selectAllInTreeButton.disabled = true;
        if (deselectAllInTreeButton) deselectAllInTreeButton.disabled = true;

        try {
            // Fetch the entire tree structure recursively
            const rootItems = await fetchDirectoryContentsRecursive(owner, repoName, '');
            const treeRoot = { name: repoName, type: 'dir', path: '', children: rootItems }; // Create a root node for rendering
            renderFileTreeUI(treeRoot, fileTreeDiv, true); // Render the tree
            generateCombinedTextButton.disabled = false;
            if (selectAllInTreeButton) selectAllInTreeButton.disabled = false;
            if (deselectAllInTreeButton) deselectAllInTreeButton.disabled = false;
        } catch (error) {
            console.error('Error fetching repository file tree:', error);
            fileTreeDiv.innerHTML = `<p>Error loading file tree: ${error.message}</p>`;
        }
    }

    async function fetchDirectoryContentsRecursive(owner, repoName, dirPath) {
        const response = await fetch(`/api/github/repo-contents?owner=${owner}&repo=${repoName}&path=${encodeURIComponent(dirPath)}`);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`Failed to fetch contents for "${dirPath || 'root'}": ${errData.details || response.statusText}`);
        }
        const items = await response.json();
        const processedItems = [];

        for (const item of items) {
            const node = {
                name: item.name,
                path: item.path,
                type: item.type,
                sha: item.sha, // Useful for unique checkbox IDs
                children: [] // Initialize children array
            };
            if (item.type === 'dir') {
                // Recursively fetch contents for subdirectories
                node.children = await fetchDirectoryContentsRecursive(owner, repoName, item.path);
            }
            processedItems.push(node);
        }
        // Sort items: directories first, then alphabetically by name
        return processedItems.sort((a, b) => {
            if (a.type === 'dir' && b.type !== 'dir') return -1;
            if (a.type !== 'dir' && b.type === 'dir') return 1;
            return a.name.localeCompare(b.name);
        });
    }

    function renderFileTreeUI(node, parentElement, isRoot = false) {
        if (isRoot) {
            parentElement.innerHTML = ''; // Clear previous tree for the root call
        }
        const ul = document.createElement('ul');

        // The `node` in recursive calls will be a child node. For the root, `node.children` are the top-level items.
        const itemsToRender = isRoot ? node.children : [node];
        
        (node.children || []).forEach(childNode => { // Iterate over actual children for a directory node
            const li = document.createElement('li');
            li.classList.add('tree-node', `tree-node-${childNode.type}`);

            const label = document.createElement('label'); // Use label for better accessibility with checkbox
            label.classList.add('node-label');

            if (childNode.type === 'file') {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.filePath = childNode.path; // Store path for later retrieval
                checkbox.dataset.fileName = childNode.name;
                checkbox.id = `cb-${childNode.sha || childNode.path.replace(/[^a-zA-Z0-9]/g, '-')}`; // Unique ID for label association
                label.htmlFor = checkbox.id; // Associate label with checkbox

                // Restore checked state if file was previously selected
                checkbox.checked = selectedFilePathsForOutput.has(childNode.path);

                checkbox.addEventListener('change', (event) => {
                    if (event.target.checked) {
                        selectedFilePathsForOutput.add(childNode.path);
                    } else {
                        selectedFilePathsForOutput.delete(childNode.path);
                    }
                    // console.log('Selected files:', selectedFilePathsForOutput); // For debugging
                });
                label.appendChild(checkbox); // Checkbox inside label
            }
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = childNode.name;
            label.appendChild(nameSpan); // Name inside label
            
            li.appendChild(label);

            // If it's a directory and has children, recursively render them
            if (childNode.type === 'dir' && childNode.children && childNode.children.length > 0) {
                renderFileTreeUI(childNode, li, false); // Pass the childNode as the new 'node' for the recursive call
            }
            ul.appendChild(li);
        });

        if (ul.hasChildNodes() || isRoot) { 
            parentElement.appendChild(ul);
        }
        
        // Handle empty root directory case
        if (isRoot && (!node.children || node.children.length === 0)) {
           parentElement.innerHTML = '<p>This repository or directory is empty.</p>';
        }
    }

    // --- 3. Select/Deselect All Files in Tree ---
    function setAllFileCheckboxesInTree(isChecked) {
        const fileCheckboxes = fileTreeDiv.querySelectorAll('input[type="checkbox"][data-file-path]');
        if (fileCheckboxes.length === 0 && isChecked) { // Only alert if trying to select when none are available
            alert("No files found in the current tree view to select.");
            return;
        }
        
        fileCheckboxes.forEach(checkbox => {
            if (checkbox.checked !== isChecked) {
                checkbox.checked = isChecked;
            }
            // Update the master set of selected files
            const filePath = checkbox.dataset.filePath;
            if (isChecked) {
                selectedFilePathsForOutput.add(filePath);
            } else {
                selectedFilePathsForOutput.delete(filePath);
            }
        });
        // console.log('Selected files after all:', selectedFilePathsForOutput); // For debugging
    }

    if (selectAllInTreeButton) {
        selectAllInTreeButton.addEventListener('click', () => {
            setAllFileCheckboxesInTree(true);
        });
    }

    if (deselectAllInTreeButton) {
        deselectAllInTreeButton.addEventListener('click', () => {
            setAllFileCheckboxesInTree(false);
        });
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
            generateCombinedTextButton.disabled = true;
            if (copyCombinedTextButton) copyCombinedTextButton.disabled = true;

            let combinedText = `Repository: ${currentSelectedRepo.owner}/${currentSelectedRepo.name}\n\n`;
            combinedText += `Selected files for inclusion (${selectedFilePathsForOutput.size} total):\n`;
            selectedFilePathsForOutput.forEach(path => {
                combinedText += `- ${path}\n`;
            });
            combinedText += "\n---\n\n";

            let filesProcessedCount = 0;
            for (const filePath of selectedFilePathsForOutput) {
                filesProcessedCount++;
                combinedOutputTextarea.value += `Fetching (${filesProcessedCount}/${selectedFilePathsForOutput.size}): ${filePath}...\n`;
                try {
                    const response = await fetch(`/api/github/file-raw?owner=${currentSelectedRepo.owner}&repo=${currentSelectedRepo.name}&path=${encodeURIComponent(filePath)}`);
                    if (!response.ok) {
                        const errorText = await response.text().catch(() => "Could not read error details from server.");
                        combinedText += `Error fetching file: ${filePath}\nStatus: ${response.status}\n${errorText}\n\n`;
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
            generateCombinedTextButton.disabled = false;
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
                        // Fallback for older browsers or if clipboard API fails
                        legacyCopyText();
                    });
            } catch (err) {
                console.error('Error in copy operation (navigator.clipboard not supported?): ', err);
                legacyCopyText();
            }
            window.getSelection().removeAllRanges(); // Deselect text after trying to copy
        });
    }

    function legacyCopyText() {
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                alert('Combined text copied to clipboard! (using fallback)');
            } else {
                alert('Fallback copy failed. Please copy manually.');
            }
        } catch (err) {
            console.error('Fallback copy method failed: ', err);
            alert('Failed to copy text. Please copy manually.');
        }
    }

}); // End of DOMContentLoaded