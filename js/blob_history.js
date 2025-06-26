import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "Comfy.BlobHistory",
    // Use a Set to store hashes of blob content to prevent duplicates.
    processedBlobHashes: new Set(),

    async setup() {
        this.loadCSS();
        this.createPanel();

        api.addEventListener("executed", this.scanForClientSideBlobs.bind(this));

        console.log("Blob History panel setup complete.");
    },

    createPanel() {
        const panel = document.createElement("div");
        panel.id = "blob-history-panel";

        const header = document.createElement("div");
        header.id = "blob-history-header";
        // Add a controls container and a "Clear" button
        header.innerHTML = `<h3>Blob History</h3>
            <div class="blob-history-controls">
                <button id="blob-history-clear" title="Clear History">Clear</button>
                <button id="blob-history-toggle" title="Toggle Panel">-</button>
            </div>`;

        const content = document.createElement("div");
        content.id = "blob-history-content";

        panel.appendChild(header);
        panel.appendChild(content);
        document.body.appendChild(panel);

        // Toggle button functionality
        document.getElementById("blob-history-toggle").addEventListener("click", () => {
            const isHidden = content.style.display === "none";
            content.style.display = isHidden ? "flex" : "none";
            document.getElementById("blob-history-toggle").textContent = isHidden ? "-" : "+";
        });

        // Clear button functionality
        document.getElementById("blob-history-clear").addEventListener("click", () => {
            content.innerHTML = ""; // Empty the visual panel
            this.processedBlobHashes.clear(); // Clear the tracking set
        });

        this.makeDraggable(panel, header);
    },

    loadCSS() { /* ... same as before ... */ },

    // Scans the DOM for blob URLs, same as before
    scanForClientSideBlobs() {
        const elements = document.querySelectorAll(
            'img[src^="blob:"], video[src^="blob:"], a[href^="blob:"]'
        );
        elements.forEach(el => {
            const url = el.src || el.href;
            if (url) {
                // We no longer check for duplicates here.
                // The check will happen after hashing in the next step.
                this.addBlobToHistory(url);
            }
        });
    },

    // This function now performs hashing to ensure uniqueness.
    async addBlobToHistory(blobUrl) {
        try {
            const response = await fetch(blobUrl);
            const blobData = await response.blob();

            // Generate a hash of the blob's content
            const buffer = await blobData.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            const hash = this.bufferToHex(hashBuffer);

            // THE FIX: Only proceed if we haven't seen this content hash before.
            if (this.processedBlobHashes.has(hash)) {
                return; // Already in history, do nothing.
            }
            this.processedBlobHashes.add(hash); // Add new hash to our tracking set.

            const mimeType = blobData.type;
            const extension = this.getExtensionForMimeType(mimeType);
            const filename = `blob_${hash.substring(0, 8)}${extension}`;

            // The rest of the function creates the UI element
            this.createHistoryItem(blobUrl, blobData, filename);

        } catch (error) {
            console.error("Blob History Error:", error);
        }
    },

    // A new function to separate UI creation from the logic
    createHistoryItem(originalUrl, blobData, filename) {
        const content = document.getElementById("blob-history-content");
        const item = document.createElement("div");
        item.className = "blob-history-item";

        let mediaElement;
        if (blobData.type.startsWith("image/")) {
            mediaElement = document.createElement("img");
        } else if (blobData.type.startsWith("video/")) {
            mediaElement = document.createElement("video");
            mediaElement.controls = true;
            mediaElement.autoplay = true;
            mediaElement.muted = true;
            mediaElement.loop = true;
        } else {
            return;
        }
        mediaElement.src = originalUrl;
        item.appendChild(mediaElement);

        const info = document.createElement("div");
        info.className = "info";

        const filenameEl = document.createElement("span");
        filenameEl.className = "filename";
        filenameEl.textContent = filename;
        info.appendChild(filenameEl);

        const saveButton = document.createElement("a");
        saveButton.className = "save-button";
        saveButton.href = URL.createObjectURL(blobData);
        saveButton.textContent = "Save";
        saveButton.setAttribute("download", filename);
        info.appendChild(saveButton);

        item.appendChild(info);
        content.prepend(item);
    },

    // Helper function to convert an ArrayBuffer to a hex string for hashing
    bufferToHex(buffer) {
        return [...new Uint8Array(buffer)]
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    getExtensionForMimeType(mimeType) { /* ... same as before ... */ },
    makeDraggable(panel, handle) { /* ... same as before ... */ }
});

// --- Paste the unchanged functions here ---
app.extensions[app.extensions.length - 1].loadCSS = function() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "extensions/private/blob_history.css";
    document.head.appendChild(link);
};
app.extensions[app.extensions.length - 1].getExtensionForMimeType = function(mimeType) {
    const mimeMap = {
        'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
        'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm',
    };
    return mimeMap[mimeType] || '.bin';
};
app.extensions[app.extensions.length - 1].makeDraggable = function(panel, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = (e) => {
        if (e.target.tagName === 'BUTTON') return; // Don't drag when clicking buttons
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
        document.onmousemove = (e) => {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            panel.style.top = (panel.offsetTop - pos2) + "px";
            panel.style.left = (panel.offsetLeft - pos1) + "px";
        };
    };
};
