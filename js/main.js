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
import { music } from './audio.js';

initCanvas();
buildBestiary();
drawClassPreviews();
initInput();

// Reveal class selection (always visible — kept here for parity with old code)
document.getElementById('class-selection').classList.remove('hidden');

// Render menu background using cached chunks near origin
drawMenuBackground();

// Initialize audio system. The actual menu track only starts after the first
// user interaction (browser autoplay policies). We listen once on document.
music.init();
const _startMenuMusic = () => { music.play('menu'); };
document.addEventListener('click',   _startMenuMusic, { once: true });
document.addEventListener('keydown', _startMenuMusic, { once: true });
document.addEventListener('touchstart', _startMenuMusic, { once: true });
