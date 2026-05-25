// ============================================================
// ENTRY POINT
// Bootstraps canvas, builds bestiary/class previews, attaches
// input handlers, and renders the static menu background.
// ============================================================
'use strict';
import { initCanvas } from './state.js';
import { buildBestiary, drawClassPreviews } from './ui.js';
import { drawMenuBackground } from './chunks.js';
import { initInput } from './input.js';

initCanvas();
buildBestiary();
drawClassPreviews();
initInput();

// Reveal class selection (always visible — kept here for parity with old code)
document.getElementById('class-selection').classList.remove('hidden');

// Render menu background using cached chunks near origin
drawMenuBackground();
