import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

// --- Helper functions (unchanged) ---
function xorCipher(data, key) { const keyLength = key.length; return data.map((byte, i) => byte ^ key[i % keyLength]); }
function hexToUint8Array(hexString) { return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16))); }
function uint8ArrayToBase64(bytes) { let binary = ''; for (let i = 0; i < bytes.length; i++) { binary += String.fromCharCode(bytes[i]); } return window.btoa(binary); }
function base64ToUint8Array(base64) { const binary_string = window.atob(base64); const len = binary_string.length; const bytes = new Uint8Array(len); for (let i = 0; i < len; i++) { bytes[i] = binary_string.charCodeAt(i); } return bytes; }

let sessionKey = null;

app.registerExtension({
	name: "Comfy.RAMNodes.Privacy",

	async setup() {
        const fetchKey = async () => { if (sessionKey || !api.clientId) return; try { const response = await api.fetchApi("/ram_nodes/get_key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: api.clientId }), }); if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`); const data = await response.json(); if (data.key) { sessionKey = hexToUint8Array(data.key); console.log("Privacy Node: Session key established."); } } catch (error) { console.error("Privacy Node: Failed to get session key.", error); } };
        api.addEventListener("status", (event) => { if (event.detail) { fetchKey(); } });
        fetchKey();

        const originalQueuePrompt = app.queuePrompt;
        app.queuePrompt = function() {
            const nodeTypesToUpdate = [
                "LoadImageFromUpload",
                "PreviewImageInRAM",
                "PreviewVideoInRAM",
                "PreviewAnimationAsWebP" // +++ Add new node type
            ];
            for (const nodeType of nodeTypesToUpdate) {
                const nodes = app.graph.findNodesByType(nodeType);
                for (const node of nodes) {
                    const widget = node.widgets.find(w => w.name === "client_id");
                    if (widget) { widget.value = api.clientId; }
                }
            }
            return originalQueuePrompt.apply(this, arguments);
        };
	},

	async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "LoadImageFromUpload") {
            // ... (LoadImageFromUpload onAdded logic remains exactly the same as previous correct version) ...
            const onAdded = nodeType.prototype.onAdded;
            nodeType.prototype.onAdded = function() {
                onAdded?.apply(this, arguments); const node = this; const textWidget = node.widgets.find(w => w.name === "encrypted_upload"); const clientIdWidget = node.widgets.find(w => w.name === "client_id"); const uploadButton = document.createElement("button"); uploadButton.textContent = "Choose Encrypted Image"; uploadButton.style.width = "100%"; const buttonDOMWidget = node.addDOMWidget("upload_button_widget", "button_container", uploadButton, {}); buttonDOMWidget.computeSize = function(width) { return [width, 30 + 8]; }
                const fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.accept = "image/jpeg,image/png,image/webp,image/gif"; fileInput.style.display = "none"; document.body.appendChild(fileInput); uploadButton.addEventListener("click", () => { if (!sessionKey) { alert("Privacy Node Error: No session key."); return; } fileInput.click(); });
                node.previewImageElement = null;
                const handleFile = (file) => { if (!sessionKey) { alert("Privacy Node: No session key to encrypt/decrypt with."); return; } const reader = new FileReader(); reader.onload = () => { const originalBytes = new Uint8Array(reader.result); const encryptedData = xorCipher(originalBytes, sessionKey); textWidget.value = uint8ArrayToBase64(encryptedData); const blob = new Blob([originalBytes], { type: file.type }); const url = URL.createObjectURL(blob); if (!node.previewImageElement) { node.previewImageElement = document.createElement("img"); node.previewImageElement.style.maxWidth = "100%"; node.previewImageElement.style.maxHeight = "100%"; node.previewImageElement.style.objectFit = "contain"; node.previewImageElement.style.display = "block"; const oldPreviewWidget = node.widgets.find(w => w.name === "loader_preview_img_widget"); if(oldPreviewWidget) node.widgets.splice(node.widgets.indexOf(oldPreviewWidget), 1); node.addDOMWidget("loader_preview_img_widget", "preview_container", node.previewImageElement, {}); } if (node.previewImageElement.oldUrl) URL.revokeObjectURL(node.previewImageElement.oldUrl); node.previewImageElement.src = url; node.previewImageElement.oldUrl = url; node.setDirtyCanvas(true, true); node.graph.setDirtyCanvas(true,true); node.computeSize(); }; reader.readAsArrayBuffer(file); };
                fileInput.addEventListener("change", (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });
                [textWidget, clientIdWidget].forEach(w => { if (w) { w.type = "hidden"; if (w.inputEl) w.inputEl.style.display = 'none'; Object.defineProperty(w, 'computed_size', { get: () => [0, -4], configurable: true, }); } }); node.computeSize();
                function setupDragDrop(element, isNodeElement = false) { element.addEventListener("dragover", (e) => { e.preventDefault(); e.stopPropagation(); if (isNodeElement) node.isDragOver = true; element.style.outline = "2px dashed green"; node.setDirtyCanvas(true, false); }, false); element.addEventListener("dragleave", (e) => { e.preventDefault(); e.stopPropagation(); if (isNodeElement) node.isDragOver = false; element.style.outline = "none"; node.setDirtyCanvas(true, false); }, false); element.addEventListener("drop", (e) => { e.preventDefault(); e.stopPropagation(); if (isNodeElement) node.isDragOver = false; element.style.outline = "none"; node.setDirtyCanvas(true, false); let file; if (e.dataTransfer.items) { if (e.dataTransfer.items[0].kind === 'file') { file = e.dataTransfer.items[0].getAsFile(); } } else { file = e.dataTransfer.files[0]; } if (file && file.type.startsWith("image/")) { handleFile(file); } else { console.warn("Privacy Node: Dropped item is not an image file."); } }, false); }
                setupDragDrop(uploadButton);
                node.onDragOver = function(e_browser) { if (e_browser.dataTransfer && e_browser.dataTransfer.types.includes("Files")) { this.isDragOver = true; this.setDirtyCanvas(true, false); return true; } return false; }; node.onDragLeave = function(e_browser) { this.isDragOver = false; this.setDirtyCanvas(true, false); }; node.onDropFile = function(file) { this.isDragOver = false; this.setDirtyCanvas(true, false); handleFile(file); };
                const originalOnDrawBackground = nodeType.prototype.onDrawBackground || ((ctx) => {}); nodeType.prototype.onDrawBackground = function(ctx) { originalOnDrawBackground.apply(this, arguments); if (this.isDragOver) { ctx.fillStyle = "rgba(25, 25, 25, 0.2)"; ctx.fillRect(0, 0, this.size[0], this.size[1]); } };
                node.onRemoved = () => { fileInput.remove(); if (node.previewImageElement && node.previewImageElement.oldUrl) { URL.revokeObjectURL(node.previewImageElement.oldUrl); } };
            }
        }

        // --- Generic Preview Handler for Image, Video, and Animated WebP ---
        const previewNodeNames = ["PreviewImageInRAM", "PreviewVideoInRAM", "PreviewAnimationAsWebP"];
        if (previewNodeNames.includes(nodeData.name)) {
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function(message) {
                onExecuted?.apply(this, arguments);

                // Clear previous content and revoke URLs
                if (this.previewElements) {
                    this.previewElements.forEach(el => {
                        if (el.oldUrl) URL.revokeObjectURL(el.oldUrl);
                    });
                }
                this.previewElements = [];
                if (this.previewContainerEl) {
                    this.previewContainerEl.innerHTML = "";
                }

                // Python now sends a `previews` array.
                // Each item in `previews` has `base64`, `type` ('image' or 'video'),
                // and `format` (for images like png, webp) or `mime_type` (for videos).
                if (message.previews && message.previews.length > 0) {
                    if (!sessionKey) {
                        console.error("Privacy Node: Cannot decrypt preview, no session key.");
                        return;
                    }

                    if (!this.previewContainerEl) {
                        this.previewContainerEl = document.createElement("div");
                        this.previewContainerEl.style.maxHeight = "100%"; // Consistent max height
                        this.previewContainerEl.style.overflowY = "auto";
                        this.addDOMWidget("preview_content_container", "preview_widget", this.previewContainerEl, {});
                    }

                    message.previews.forEach(previewData => {
                        if (previewData.base64) {
                            const encryptedData = base64ToUint8Array(previewData.base64);
                            const decryptedData = xorCipher(encryptedData, sessionKey);

                            let mediaElement;
                            let mimeType;

                            if (previewData.type === "image") {
                                mediaElement = document.createElement("img");
                                mimeType = previewData.format ? `image/${previewData.format}` : 'image/png';
                            } else if (previewData.type === "video") {
                                mediaElement = document.createElement("video");
                                mediaElement.controls = true;
                                mediaElement.autoplay = true;
                                mediaElement.muted = true;
                                mediaElement.loop = true;
                                mimeType = previewData.mime_type || 'video/mp4';
                            } else {
                                console.warn("Privacy Node: Unknown preview type:", previewData.type);
                                return; // Skip this preview item
                            }

                            const blob = new Blob([decryptedData], { type: mimeType });
                            const url = URL.createObjectURL(blob);

                            mediaElement.src = url;
                            mediaElement.oldUrl = url; // For later revocation
                            mediaElement.style.maxWidth = "100%";
                            mediaElement.style.display = "block"; // Good for layout

                            this.previewContainerEl.appendChild(mediaElement);
                            this.previewElements.push(mediaElement);
                        }
                    });

                    this.setDirtyCanvas(true, true);
                    this.graph.setDirtyCanvas(true,true);
                    this.computeSize();
                }
            };

            const onRemoved = nodeType.prototype.onRemoved;
            nodeType.prototype.onRemoved = function() {
                onRemoved?.apply(this, arguments);
                if (this.previewElements) {
                    this.previewElements.forEach(el => {
                        if (el.oldUrl) URL.revokeObjectURL(el.oldUrl);
                    });
                }
            };
        }
	},
});