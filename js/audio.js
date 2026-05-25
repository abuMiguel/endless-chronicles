// ============================================================
// MUSIC MANAGER
// Crossfading audio for menu / exploration / combat / boss / endgame.
// Volume + mute preferences persisted via localStorage.
// ============================================================
'use strict';

const ASSET_BASE = 'https://customer-assets.emergentagent.com/job_dungeon-depths-1/artifacts';
const TRACKS = {
    menu:    `${ASSET_BASE}/vijw8s3g_Sunday_Morning_Blueprints.mp3`,
    explore: `${ASSET_BASE}/8p8w6f10_Beneath_the_Wooden_Boughs.mp3`,
    combat:  `${ASSET_BASE}/ywnjz6wg_Blade_of_the_Emerald_Grove.mp3`,
    boss:    `${ASSET_BASE}/ds2877cg_Gravity_s_Last_Sprint.mp3`,
    endgame: `${ASSET_BASE}/tj4my66z_The_Final_Screen.mp3`,
};

const STORAGE_KEY = 'endlessChronicles_audio';
const FADE_STEP_MS = 80;
const FADE_DELTA   = 0.07;

class MusicManager {
    constructor() {
        this.elements = {};       // track id -> HTMLAudioElement
        this.fadeTimers = {};     // track id -> interval id
        this.currentTrack = null;
        this.volume = 0.45;
        this.muted = false;
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        this._initialized = true;
        // Restore prefs
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            if (typeof saved.volume === 'number') this.volume = saved.volume;
            if (typeof saved.muted === 'boolean') this.muted = saved.muted;
        } catch (_) {}
        // Lazy-create audio elements (one per track)
        for (const [id, url] of Object.entries(TRACKS)) {
            const a = new Audio();
            a.src = url;
            a.loop = true;
            a.volume = 0;
            a.preload = 'auto';
            // Cross-origin asset — be permissive about errors (autoplay block, network)
            a.addEventListener('error', () => { /* silent */ });
            this.elements[id] = a;
        }
    }

    // Switch to a track with crossfade. No-op if already playing.
    play(trackId) {
        if (!this._initialized) this.init();
        if (this.currentTrack === trackId) return;
        // Fade out current
        if (this.currentTrack && this.elements[this.currentTrack]) {
            this._fadeOut(this.currentTrack);
        }
        this.currentTrack = trackId;
        if (!trackId || this.muted) return;
        const a = this.elements[trackId];
        if (!a) return;
        // Browser autoplay policies — first play() may reject until user interacts.
        // We swallow the rejection and retry on next user input via main.js click handler.
        const playPromise = a.play();
        if (playPromise && playPromise.catch) playPromise.catch(() => {});
        this._fadeIn(trackId);
    }

    stop() {
        if (this.currentTrack) this._fadeOut(this.currentTrack);
        this.currentTrack = null;
    }

    _fadeIn(trackId) {
        const a = this.elements[trackId];
        const target = this.volume;
        if (this.fadeTimers[trackId]) { clearInterval(this.fadeTimers[trackId]); }
        this.fadeTimers[trackId] = setInterval(() => {
            a.volume = Math.min(target, a.volume + FADE_DELTA);
            if (a.volume >= target - 0.001) {
                a.volume = target;
                clearInterval(this.fadeTimers[trackId]);
                delete this.fadeTimers[trackId];
            }
        }, FADE_STEP_MS);
    }

    _fadeOut(trackId) {
        const a = this.elements[trackId];
        if (!a) return;
        if (this.fadeTimers[trackId]) { clearInterval(this.fadeTimers[trackId]); }
        this.fadeTimers[trackId] = setInterval(() => {
            a.volume = Math.max(0, a.volume - FADE_DELTA);
            if (a.volume <= 0.001) {
                a.volume = 0;
                a.pause();
                clearInterval(this.fadeTimers[trackId]);
                delete this.fadeTimers[trackId];
            }
        }, FADE_STEP_MS);
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.currentTrack && this.elements[this.currentTrack] && !this.muted) {
            // Don't yank — fade-in target will adjust naturally if mid-fade; otherwise set directly
            const a = this.elements[this.currentTrack];
            if (!this.fadeTimers[this.currentTrack]) a.volume = this.volume;
        }
        this._save();
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            for (const a of Object.values(this.elements)) {
                if (!a.paused) a.pause();
            }
            for (const k of Object.keys(this.fadeTimers)) { clearInterval(this.fadeTimers[k]); delete this.fadeTimers[k]; }
        } else if (this.currentTrack) {
            const a = this.elements[this.currentTrack];
            a.volume = 0;
            const p = a.play();
            if (p && p.catch) p.catch(() => {});
            this._fadeIn(this.currentTrack);
        }
        this._save();
    }

    isMuted() { return this.muted; }

    _save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                volume: this.volume, muted: this.muted,
            }));
        } catch (_) {}
    }
}

export const music = new MusicManager();
