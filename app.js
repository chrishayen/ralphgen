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
 * Initialize the application
 * @returns {void}
 */
function init() {
    initCanvas();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
