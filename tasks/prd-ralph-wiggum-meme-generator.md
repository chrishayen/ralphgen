# PRD: Ralph Wiggum Meme Generator

## Introduction

A single-page web application for generating Ralph Wiggum memes using z-image (Stable Diffusion) over Tailscale. Users enter prompts to generate Ralph Wiggum images, then add text overlays using a full-featured meme editor with draggable text boxes, multiple fonts, colors, sizes, and rotation. Generated memes can be downloaded or saved to a local gallery for later access.

This is a personal/fun project for use among friends, accessed via Tailscale network.

## Goals

- Generate Ralph Wiggum images from text prompts via z-image over Tailscale
- Provide full meme editing capabilities (multiple text boxes, fonts, colors, sizes, rotation)
- Allow downloading finished memes as images
- Maintain a gallery of previously generated memes
- Keep the UI simple and fun to use

## User Stories

### US-001: Project Setup and Basic Structure
**Description:** As a developer, I need the project scaffolded with the right tools so I can build the meme generator.

**Acceptance Criteria:**
- [ ] HTML file with basic page structure
- [ ] CSS for layout and styling
- [ ] Fabric.js integrated for canvas-based editing
- [ ] Basic responsive layout that works on desktop
- [ ] Typecheck/lint passes (if using TypeScript)

### US-002: Prompt Input and Image Generation
**Description:** As a user, I want to enter a text prompt and generate a Ralph Wiggum image so I can create custom meme bases.

**Acceptance Criteria:**
- [ ] Text input field for entering SD prompts
- [ ] "Generate" button to trigger image generation
- [ ] Loading indicator while image generates
- [ ] Generated image displays on the canvas
- [ ] Error message displays if z-image request fails
- [ ] Verify in browser using dev-browser skill

### US-003: Add Text Box to Canvas
**Description:** As a user, I want to add text boxes to my generated image so I can create meme captions.

**Acceptance Criteria:**
- [ ] "Add Text" button adds a new text box to canvas
- [ ] Text box appears with default placeholder text
- [ ] Text box is immediately editable (double-click to edit)
- [ ] Can add multiple text boxes
- [ ] Verify in browser using dev-browser skill

### US-004: Move and Position Text
**Description:** As a user, I want to drag text boxes around the image so I can position my captions exactly where I want them.

**Acceptance Criteria:**
- [ ] Text boxes are draggable via mouse/touch
- [ ] Position updates in real-time while dragging
- [ ] Text stays within canvas bounds (optional snap)
- [ ] Selected text box shows selection handles
- [ ] Verify in browser using dev-browser skill

### US-005: Resize Text
**Description:** As a user, I want to resize text boxes so I can make text larger or smaller.

**Acceptance Criteria:**
- [ ] Text boxes have resize handles when selected
- [ ] Dragging handles scales text proportionally
- [ ] Font size slider/input for precise control
- [ ] Minimum and maximum size limits prevent unusable text
- [ ] Verify in browser using dev-browser skill

### US-006: Rotate Text
**Description:** As a user, I want to rotate text boxes so I can angle my captions for effect.

**Acceptance Criteria:**
- [ ] Rotation handle on selected text box
- [ ] Dragging rotation handle rotates text smoothly
- [ ] Rotation angle displayed during rotation
- [ ] Option to reset rotation to 0 degrees
- [ ] Verify in browser using dev-browser skill

### US-007: Change Text Font
**Description:** As a user, I want to choose different fonts so my memes have the right style.

**Acceptance Criteria:**
- [ ] Font dropdown with at least 5 meme-appropriate fonts (Impact, Arial Black, Comic Sans, etc.)
- [ ] Selected text box updates to chosen font immediately
- [ ] Font preview in dropdown
- [ ] Verify in browser using dev-browser skill

### US-008: Change Text Color
**Description:** As a user, I want to change text color so I can make text stand out against any background.

**Acceptance Criteria:**
- [ ] Color picker for text fill color
- [ ] Color picker for text stroke/outline color
- [ ] Stroke width control (for outline thickness)
- [ ] Classic meme style preset (white fill, black outline)
- [ ] Verify in browser using dev-browser skill

### US-009: Delete Text Box
**Description:** As a user, I want to delete text boxes I no longer need.

**Acceptance Criteria:**
- [ ] Delete button removes currently selected text box
- [ ] Keyboard shortcut (Delete/Backspace) also works
- [ ] Confirmation not required (undo would be nice-to-have)
- [ ] Verify in browser using dev-browser skill

### US-010: Download Meme
**Description:** As a user, I want to download my finished meme as an image file so I can share it.

**Acceptance Criteria:**
- [ ] "Download" button exports canvas as PNG
- [ ] Downloaded file has reasonable filename (e.g., ralph-meme-[timestamp].png)
- [ ] Image includes all text overlays flattened
- [ ] Download works in major browsers (Chrome, Firefox)
- [ ] Verify in browser using dev-browser skill

### US-011: Save to Gallery
**Description:** As a user, I want to save memes to a gallery so I can view them later.

**Acceptance Criteria:**
- [ ] "Save to Gallery" button stores meme locally (localStorage or IndexedDB)
- [ ] Saves both the final composite image and metadata (prompt, timestamp)
- [ ] Success feedback when saved
- [ ] Verify in browser using dev-browser skill

### US-012: View Gallery
**Description:** As a user, I want to browse my saved memes so I can find and reuse them.

**Acceptance Criteria:**
- [ ] Gallery view shows thumbnails of saved memes
- [ ] Clicking thumbnail shows full-size image
- [ ] Display shows original prompt used
- [ ] Option to delete memes from gallery
- [ ] Verify in browser using dev-browser skill

### US-013: Load from Gallery to Editor
**Description:** As a user, I want to load a saved meme back into the editor so I can modify it or use it as a base.

**Acceptance Criteria:**
- [ ] "Edit" or "Load" button on gallery items
- [ ] Loads image back onto canvas
- [ ] Clears any existing text boxes
- [ ] User can add new text overlays
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Single HTML page with embedded or linked CSS/JS
- FR-2: Text input field accepts any string as SD prompt
- FR-3: Generate button sends POST request to z-image endpoint over Tailscale
- FR-4: Canvas displays generated image as background layer
- FR-5: Text boxes are Fabric.js text objects with full manipulation (move, resize, rotate)
- FR-6: Font selector offers: Impact, Arial Black, Comic Sans MS, Bangers, Permanent Marker
- FR-7: Color pickers use native HTML5 color input or simple preset palette
- FR-8: Text stroke (outline) rendered using Fabric.js stroke properties
- FR-9: Export flattens canvas to PNG using toDataURL()
- FR-10: Gallery uses localStorage to persist meme data as base64 + metadata JSON
- FR-11: z-image endpoint URL configurable (environment variable or config)

## Non-Goals

- No user authentication or accounts
- No cloud storage or sync (local only)
- No sharing functionality (users share manually)
- No advanced SD parameters (steps, CFG, seed, etc.) in v1
- No mobile-optimized layout (desktop-first, should work but not optimized)
- No undo/redo functionality in v1
- No image upload (only z-image generated images)
- No pre-made meme templates

## Design Considerations

- Layout: Two-panel design (left: canvas/editor, right: controls/gallery)
- Canvas should be prominently displayed, at least 512x512px
- Controls should be clearly grouped (prompt, text formatting, actions)
- Use a fun, casual aesthetic appropriate for a meme generator
- Dark theme preferred (easier on eyes, memes pop more)

## Technical Considerations

- **Fabric.js**: Best library for interactive canvas with text manipulation
- **z-image endpoint**: Assumes endpoint accepts POST with prompt, returns image (base64 or URL)
- **Tailscale**: App assumes it's accessed via Tailscale network where z-image is available
- **localStorage limits**: ~5-10MB depending on browser; gallery may need cleanup for heavy users
- **CORS**: z-image endpoint must allow requests from the app's origin
- **No build step preferred**: Vanilla HTML/CSS/JS with Fabric.js via CDN for simplicity

## Success Metrics

- User can generate an image and add text in under 30 seconds
- Text editing feels responsive (no lag on drag/resize)
- Downloaded memes look identical to canvas preview
- Gallery persists across browser sessions

## Open Questions

- What is the exact z-image API endpoint URL and request format?
- Are there any rate limits on z-image that should be communicated to users?
- Should there be a "Ralph Wiggum" prefix auto-added to prompts, or leave fully user-controlled?
- What's the target image size from z-image (512x512, 768x768, etc.)?
