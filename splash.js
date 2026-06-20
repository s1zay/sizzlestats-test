// --- SIZZLESTATS SPLASH PAGE LOGIC ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Tell the browser to stop auto-scrolling on refresh
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    // 2. Snap instantly to the absolute top of the page
    window.scrollTo(0, 0);

    // 3. Initialize Drag & Drop Listeners
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('imageLoader');

    if (dropZone && fileInput) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = 'rgba(234, 179, 8, 0.1)'; // Slight glow
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = 'var(--bg-card)';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = 'var(--bg-card)';

            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;

                // Manually wake up the scanner engine so it processes the drop
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));

                // Manually trigger the preview logic
                handleImagePreview({ target: fileInput });
            }
        });
    }
});

// 1. Handles grabbing the file, showing the preview instantly, and grabbing the name
function handleImagePreview(event) {
    const file = event.target.files[0];
    if (file) {
        // Inject the filename into the UI
        const fileNameEl = document.getElementById('preview-filename');
        if (fileNameEl) fileNameEl.innerText = file.name;

        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('image-preview-element').src = e.target.result;
            document.getElementById('drop-zone').style.display = 'none';
            document.getElementById('preview-zone').style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
}

// 2. Resets the box if the user hit the wrong image
function resetUpload() {
    document.getElementById('imageLoader').value = "";
    document.getElementById('image-preview-element').src = "";
    document.getElementById('preview-zone').style.display = 'none';
    document.getElementById('drop-zone').style.display = 'block';

    // Clear the filename text
    const fileNameEl = document.getElementById('preview-filename');
    if (fileNameEl) fileNameEl.innerText = "";
}

// 3. The big transition: Hides Splash, reveals Lens, and triggers your engine
function startScanProcess() {
    // Hide Splash, Show Lens
    document.getElementById('splash-view').style.display = 'none';
    document.getElementById('lens-view').style.display = 'grid';

    // Show the dynamic navigation and set it to Lens state
    document.getElementById('mainNavigation').style.display = 'flex';
    document.getElementById('nav-state-lens').style.display = 'flex';
    document.getElementById('nav-state-sandbox').style.display = 'none';

    // Optional visual flair
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.innerText = "INITIALIZING ENGINE...";
        statusEl.style.color = "var(--indicator-active)";
    }
}

// 4. The Boomerang: Clears current data and returns to the Splash screen
function resetToSplash() {
    // 1. Nuke the data memory
    if (window.SizzleState) {
        window.SizzleState.currentScan = null;
    }

    // 2. Reset the Splash screen UI
    resetUpload();

    // 3. Reset the Lens Status Indicator
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.innerText = "SCANNER READY";
        statusEl.style.color = ""; // removes any active colors
    }

    // 4. Reset the Identity Card text to default
    const nameEl = document.getElementById('champ-name');
    if (nameEl) {
        nameEl.innerText = "Awaiting Upload...";
        nameEl.style.color = "var(--text-muted)";
    }

    // Clear out the level and stars so they don't ghost on the next scan
    document.getElementById('champ-lvl').innerText = "";
    document.getElementById('champ-stars').innerHTML = "";

    // Clear out the traits so they don't ghost
    document.getElementById('champ-affinity').innerText = "-";
    document.getElementById('champ-faction').innerText = "-";
    document.getElementById('champ-role').innerText = "-";

    // 5. Swap the views and hide dynamic navigation
    document.getElementById('lens-view').style.display = 'none';
    document.getElementById('mirage-view').style.display = 'none'; // Ensure Sandbox closes
    document.getElementById('mainNavigation').style.display = 'none'; // Hide the arrows
    document.getElementById('splash-view').style.display = 'flex';
}
