// @ts-check
/// <reference types="fabric" />

// RalphGen - Ralph Wiggum Meme Generator

/** @type {typeof fabric} */
// @ts-ignore - fabric is loaded via CDN
const fabricLib = fabric;

// Configuration
const CONFIG = {
    zImageEndpoint: 'http://localhost:8000/generate',
    canvasWidth: 512,
    canvasHeight: 512
};

// Global state
/** @type {fabric.Canvas | null} */
let canvas = null;

/** @type {fabric.Image | null} */
let backgroundImage = null;

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

    canvas.renderAll();
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

    const prompt = promptInput.value.trim();
    if (!prompt) {
        showError('Please enter a prompt');
        return;
    }

    hideError();
    showLoading();
    generateBtn.disabled = true;

    try {
        const response = await fetch(CONFIG.zImageEndpoint, {
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
 * Initialize event listeners
 * @returns {void}
 */
function initEventListeners() {
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateImage);
    }
}

/**
 * Initialize the application
 * @returns {void}
 */
function init() {
    initCanvas();
    initEventListeners();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
