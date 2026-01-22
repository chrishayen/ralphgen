// @ts-check
/// <reference types="fabric" />

// RalphGen - Ralph Wiggum Meme Generator

/**
 * Process prompt to ensure trigger word is present
 * @param {string} prompt - User's input prompt
 * @returns {string} - Processed prompt with trigger word
 */
function processPrompt(prompt) {
    const triggerWord = 'ralphwiggum';

    // Replace "ralph" or "wiggum" (case insensitive, whole words) with trigger
    let processed = prompt.replace(/\bralph\b/gi, triggerWord);
    processed = processed.replace(/\bwiggum\b/gi, triggerWord);

    // If trigger word still not present, prepend it
    if (!processed.toLowerCase().includes(triggerWord)) {
        processed = triggerWord + ' ' + processed;
    }

    return processed;
}

// Expose processPrompt for testing immediately
// @ts-ignore
window.processPrompt = processPrompt;

/** @type {typeof fabric} */
// @ts-ignore - fabric is loaded via CDN
const fabricLib = fabric;

// Configuration (zImageEndpoint loaded from server)
const CONFIG = {
    zImageEndpoint: 'http://localhost:8000/generate',
    canvasWidth: 512,
    canvasHeight: 512,
    galleryKey: 'ralphgen-gallery'
};

/**
 * Load configuration from server
 * @returns {Promise<void>}
 */
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const serverConfig = await response.json();
            if (serverConfig.zImageEndpoint) {
                CONFIG.zImageEndpoint = serverConfig.zImageEndpoint;
            }
        }
    } catch {
        // Use default config if server config unavailable
    }
}

// Global state
/** @type {fabric.Canvas | null} */
let canvas = null;

// Expose canvas for testing
// @ts-ignore
window.canvas = null;

/** @type {fabric.Image | null} */
let backgroundImage = null;

/** @type {string} */
let currentPrompt = '';

/**
 * Initialize the Fabric.js canvas
 * @returns {void}
 */
function initCanvas() {
    canvas = new fabricLib.Canvas('meme-canvas', {
        width: CONFIG.canvasWidth,
        height: CONFIG.canvasHeight,
        backgroundColor: '#4a4a4a'
    });

    // Expose canvas on window for testing
    // @ts-ignore
    window.canvas = canvas;

    // Update controls when selection changes
    canvas.on('selection:created', updateControlsFromSelection);
    canvas.on('selection:updated', updateControlsFromSelection);
    canvas.on('selection:cleared', clearControlSelection);

    canvas.renderAll();
}

/**
 * Update control panel inputs based on selected object
 * @returns {void}
 */
function updateControlsFromSelection() {
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'i-text') return;

    const text = /** @type {fabric.IText} */ (activeObject);

    const fontSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('font-select'));
    const fillColor = /** @type {HTMLInputElement | null} */ (document.getElementById('fill-color'));
    const strokeColor = /** @type {HTMLInputElement | null} */ (document.getElementById('stroke-color'));
    const strokeWidth = /** @type {HTMLInputElement | null} */ (document.getElementById('stroke-width'));

    if (fontSelect && text.fontFamily) {
        fontSelect.value = text.fontFamily;
    }
    if (fillColor && typeof text.fill === 'string') {
        fillColor.value = text.fill;
    }
    if (strokeColor && typeof text.stroke === 'string') {
        strokeColor.value = text.stroke;
    }
    if (strokeWidth && typeof text.strokeWidth === 'number') {
        strokeWidth.value = String(text.strokeWidth);
    }
}

/**
 * Clear control selection state
 * @returns {void}
 */
function clearControlSelection() {
    // Could reset controls to default values here if needed
}

/**
 * Show loading indicator
 * @returns {void}
 */
function showLoading() {
    const loadingEl = document.getElementById('loading-indicator');
    if (loadingEl) {
        loadingEl.classList.remove('hidden');
    }
}

/**
 * Hide loading indicator
 * @returns {void}
 */
function hideLoading() {
    const loadingEl = document.getElementById('loading-indicator');
    if (loadingEl) {
        loadingEl.classList.add('hidden');
    }
}

/**
 * Show error message
 * @param {string} message - Error message to display
 * @returns {void}
 */
function showError(message) {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
}

/**
 * Hide error message
 * @returns {void}
 */
function hideError() {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.classList.add('hidden');
    }
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {'success' | 'error'} type - Toast type
 * @returns {void}
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

/**
 * Set the background image on the canvas
 * @param {string} imageUrl - URL or data URL of the image
 * @returns {Promise<void>}
 */
function setBackgroundImage(imageUrl) {
    return new Promise((resolve, reject) => {
        if (!canvas) {
            reject(new Error('Canvas not initialized'));
            return;
        }

        fabricLib.Image.fromURL(imageUrl, (img) => {
            if (!img || !canvas) {
                reject(new Error('Failed to load image'));
                return;
            }

            // Remove previous background image if exists
            if (backgroundImage) {
                canvas.remove(backgroundImage);
            }

            // Scale image to fit canvas
            const scaleX = CONFIG.canvasWidth / (img.width || 1);
            const scaleY = CONFIG.canvasHeight / (img.height || 1);
            const scale = Math.min(scaleX, scaleY);

            img.scale(scale);
            img.set({
                left: 0,
                top: 0,
                selectable: false,
                evented: false
            });

            backgroundImage = img;
            canvas.add(img);
            canvas.sendToBack(img);
            canvas.renderAll();
            resolve();
        }, { crossOrigin: 'anonymous' });
    });
}

/**
 * Generate image from z-image API
 * @returns {Promise<void>}
 */
async function generateImage() {
    const promptInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('prompt-input'));
    const generateBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('generate-btn'));

    if (!promptInput || !generateBtn) {
        return;
    }

    const userPrompt = promptInput.value.trim();
    if (!userPrompt) {
        showError('Please enter a prompt');
        return;
    }

    const prompt = processPrompt(userPrompt);

    hideError();
    showLoading();
    generateBtn.disabled = true;
    currentPrompt = userPrompt;  // Store user's original prompt for gallery

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        // z-image returns base64 image in various possible formats
        let imageUrl = '';
        if (data.image) {
            // If it's already a data URL
            if (data.image.startsWith('data:')) {
                imageUrl = data.image;
            } else {
                // Assume base64 PNG
                imageUrl = `data:image/png;base64,${data.image}`;
            }
        } else if (data.url) {
            imageUrl = data.url;
        } else {
            throw new Error('No image in response');
        }

        await setBackgroundImage(imageUrl);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate image';
        showError(message);
    } finally {
        hideLoading();
        generateBtn.disabled = false;
    }
}

/**
 * Add a new text box to the canvas
 * @returns {void}
 */
function addTextBox() {
    if (!canvas) {
        return;
    }

    const text = new fabricLib.IText('Your text here', {
        left: CONFIG.canvasWidth / 2,
        top: CONFIG.canvasHeight / 2,
        originX: 'center',
        originY: 'center',
        fontFamily: 'Bangers',
        fontSize: 40,
        fill: '#ffffff',
        stroke: '#ffffff',
        strokeWidth: 1
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
}

/**
 * Delete the currently selected text box
 * @returns {void}
 */
function deleteSelectedText() {
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    // Only delete if it's a text object and not in editing mode
    if (activeObject.type === 'i-text') {
        const textObj = /** @type {fabric.IText} */ (activeObject);
        if (!textObj.isEditing) {
            canvas.remove(activeObject);
            canvas.renderAll();
        }
    }
}

/**
 * Change font of selected text
 * @param {string} fontFamily - Font family name
 * @returns {void}
 */
function changeFont(fontFamily) {
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'i-text') return;

    const text = /** @type {fabric.IText} */ (activeObject);
    text.set('fontFamily', fontFamily);
    canvas.renderAll();
}

/**
 * Change fill color of selected text
 * @param {string} color - Hex color string
 * @returns {void}
 */
function changeFillColor(color) {
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'i-text') return;

    const text = /** @type {fabric.IText} */ (activeObject);
    text.set('fill', color);
    canvas.renderAll();
}

/**
 * Change stroke color of selected text
 * @param {string} color - Hex color string
 * @returns {void}
 */
function changeStrokeColor(color) {
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'i-text') return;

    const text = /** @type {fabric.IText} */ (activeObject);
    text.set('stroke', color);
    canvas.renderAll();
}

/**
 * Change stroke width of selected text
 * @param {number} width - Stroke width
 * @returns {void}
 */
function changeStrokeWidth(width) {
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'i-text') return;

    const text = /** @type {fabric.IText} */ (activeObject);
    text.set('strokeWidth', width);
    canvas.renderAll();
}

/**
 * Apply meme style preset to selected text
 * @returns {void}
 */
function applyMemeStyle() {
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'i-text') return;

    const text = /** @type {fabric.IText} */ (activeObject);
    text.set({
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 3
    });

    // Update UI controls
    const fillColor = /** @type {HTMLInputElement | null} */ (document.getElementById('fill-color'));
    const strokeColor = /** @type {HTMLInputElement | null} */ (document.getElementById('stroke-color'));
    const strokeWidth = /** @type {HTMLInputElement | null} */ (document.getElementById('stroke-width'));

    if (fillColor) fillColor.value = '#ffffff';
    if (strokeColor) strokeColor.value = '#000000';
    if (strokeWidth) strokeWidth.value = '3';

    canvas.renderAll();
}

/**
 * Download canvas as PNG and save to gallery
 * @returns {Promise<void>}
 */
async function downloadMeme() {
    if (!canvas) return;

    // Only allow download/save if an image has been generated
    if (!backgroundImage) {
        showError('Please generate an image first');
        return;
    }

    // Deselect any active object to hide selection handles
    canvas.discardActiveObject();
    canvas.renderAll();

    const dataUrl = canvas.toDataURL({
        format: 'png',
        quality: 1
    });

    const timestamp = Date.now();
    const filename = `ralph-meme-${timestamp}.png`;

    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Also save to gallery
    await saveToGalleryWithDataUrl(dataUrl);
}

/**
 * @typedef {Object} GalleryItem
 * @property {string} id - Unique ID
 * @property {string} image - Image URL
 * @property {string} prompt - Original prompt used
 * @property {number} timestamp - Unix timestamp when saved
 */

/** @type {GalleryItem[]} */
let galleryItems = [];

/**
 * Fetch gallery items from server
 * @returns {Promise<GalleryItem[]>}
 */
async function fetchGalleryItems() {
    try {
        const response = await fetch('/api/gallery');
        if (!response.ok) return [];
        galleryItems = await response.json();
        return galleryItems;
    } catch {
        return [];
    }
}

/**
 * Save to gallery with provided data URL
 * @param {string} dataUrl - The image data URL to save
 * @returns {Promise<void>}
 */
async function saveToGalleryWithDataUrl(dataUrl) {
    const promptInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('prompt-input'));
    const prompt = promptInput ? promptInput.value.trim() : currentPrompt;

    try {
        const response = await fetch('/api/gallery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: dataUrl,
                prompt: prompt,
                timestamp: Date.now()
            })
        });

        if (!response.ok) throw new Error('Failed to save');

        await fetchGalleryItems();
        renderGallery();
    } catch (error) {
        console.error('Failed to save to gallery:', error);
    }
}

/**
 * Show gallery preview
 * @param {string} id - ID of item to preview
 * @returns {void}
 */
function showGalleryPreview(id) {
    const item = galleryItems.find(i => i.id === id);
    if (!item) return;

    const preview = document.getElementById('gallery-preview');
    const previewImage = /** @type {HTMLImageElement | null} */ (document.getElementById('preview-image'));
    const previewPrompt = document.getElementById('preview-prompt');

    if (preview && previewImage && previewPrompt) {
        previewImage.src = item.image;
        previewPrompt.textContent = item.prompt || '(no prompt)';
        preview.classList.remove('hidden');
    }
}

/**
 * Close gallery preview
 * @returns {void}
 */
function closeGalleryPreview() {
    const preview = document.getElementById('gallery-preview');
    if (preview) {
        preview.classList.add('hidden');
    }
}

/**
 * Generate a seeded random number for consistent positioning
 * @param {number} seed - Seed value
 * @returns {function(): number}
 */
function seededRandom(seed) {
    return function() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
}

/**
 * Render gallery items scattered on the background
 * @returns {void}
 */
function renderGallery() {
    const background = document.getElementById('gallery-background');
    if (!background) return;

    background.innerHTML = '';

    galleryItems.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'gallery-item';

        // Use timestamp as seed for consistent random positioning
        const rand = seededRandom(item.timestamp);

        // Position randomly across the whole screen
        const x = rand() * 85 + 5; // 5-90% from left
        const y = rand() * 75 + 10; // 10-85% from top

        const rotation = (rand() - 0.5) * 30; // -15 to 15 degrees

        div.style.left = `${x}%`;
        div.style.top = `${y}%`;
        div.style.transform = `rotate(${rotation}deg)`;

        div.innerHTML = `
            <img src="${item.image}" alt="Saved meme">
        `;

        // Click on image to preview
        div.querySelector('img')?.addEventListener('click', () => showGalleryPreview(item.id));

        background.appendChild(div);
    });
}

/**
 * Initialize event listeners
 * @returns {void}
 */
function initEventListeners() {
    // Generate button
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateImage);
    }

    // Add text button
    const addTextBtn = document.getElementById('add-text-btn');
    if (addTextBtn) {
        addTextBtn.addEventListener('click', addTextBox);
    }

    // Delete text button
    const deleteTextBtn = document.getElementById('delete-text-btn');
    if (deleteTextBtn) {
        deleteTextBtn.addEventListener('click', deleteSelectedText);
    }

    // Font selector
    const fontSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('font-select'));
    if (fontSelect) {
        fontSelect.addEventListener('change', () => {
            changeFont(fontSelect.value);
        });
    }

    // Fill color
    const fillColor = /** @type {HTMLInputElement | null} */ (document.getElementById('fill-color'));
    if (fillColor) {
        fillColor.addEventListener('input', () => {
            changeFillColor(fillColor.value);
        });
        fillColor.addEventListener('change', () => {
            changeFillColor(fillColor.value);
        });
    }

    // Stroke color
    const strokeColor = /** @type {HTMLInputElement | null} */ (document.getElementById('stroke-color'));
    if (strokeColor) {
        strokeColor.addEventListener('input', () => {
            changeStrokeColor(strokeColor.value);
        });
        strokeColor.addEventListener('change', () => {
            changeStrokeColor(strokeColor.value);
        });
    }

    // Stroke width
    const strokeWidth = /** @type {HTMLInputElement | null} */ (document.getElementById('stroke-width'));
    if (strokeWidth) {
        strokeWidth.addEventListener('input', () => {
            changeStrokeWidth(Number(strokeWidth.value));
        });
        strokeWidth.addEventListener('change', () => {
            changeStrokeWidth(Number(strokeWidth.value));
        });
    }

    // Meme style preset button
    const memeStyleBtn = document.getElementById('meme-style-btn');
    if (memeStyleBtn) {
        memeStyleBtn.addEventListener('click', applyMemeStyle);
    }

    // Download button
    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadMeme);
    }

    // Close preview button
    const closePreviewBtn = document.getElementById('close-preview');
    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', closeGalleryPreview);
    }

    // Close preview on background click
    const preview = document.getElementById('gallery-preview');
    if (preview) {
        preview.addEventListener('click', (e) => {
            if (e.target === preview) {
                closeGalleryPreview();
            }
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Delete key to remove selected text (when not in input/textarea)
        if ((e.key === 'Delete' || e.key === 'Backspace') &&
            !(e.target instanceof HTMLInputElement) &&
            !(e.target instanceof HTMLTextAreaElement)) {
            // Check if text is in editing mode
            if (canvas) {
                const activeObject = canvas.getActiveObject();
                if (activeObject && activeObject.type === 'i-text') {
                    const textObj = /** @type {fabric.IText} */ (activeObject);
                    if (!textObj.isEditing) {
                        e.preventDefault();
                        deleteSelectedText();
                    }
                }
            }
        }
    });
}

/**
 * Initialize the application
 * @returns {Promise<void>}
 */
async function init() {
    await loadConfig();
    initCanvas();
    initEventListeners();
    await fetchGalleryItems();
    renderGallery();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
