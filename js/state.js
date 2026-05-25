// ============================================================
// SHARED STATE & CONSTANTS
// All cross-module mutable game state lives on the `S` object.
// ============================================================
'use strict';

// World/render constants
export const WORLD_SEED   = 69420;
export const TILE_SIZE    = 32;
export const CHUNK_TILES  = 16;
export const CHUNK_PX     = CHUNK_TILES * TILE_SIZE; // 512 px
export const TREE_COLL_R  = 13;
export const TOWN_RADIUS  = 380;

// Cache caps (tuned for "millions of blocks" exploration)
export const CHUNK_CACHE_MAX     = 256;   // ~67 MB max @ 512x512 canvases
export const BIOME_CACHE_MAX     = 80000; // soft cap for biome lookups
export const CHUNK_PRUNE_RADIUS  = 8;     // chunks farther than this get pruned
export const CHUNK_PRUNE_INTERVAL = 2.0;  // seconds between distance prunes

export const GameState = Object.freeze({
    MENU:'menu', PLAYING:'playing', PAUSED:'paused', LEVEL_UP:'level_up', GAME_OVER:'game_over'
});

// Shared mutable state — single source of truth across all modules.
// Use `S.player`, `S.enemies`, etc. everywhere.
export const S = {
    canvas: null,
    ctx: null,
    currentState: GameState.MENU,
    lastTime: 0,
    animationFrameId: null,
    camera: { x:0, y:0 },
    keys: {},
    player: null,
    enemies: [],
    projectiles: [],
    particles: [],
    floatTexts: [],
    items: [],
    chests: [],
    archerTowers: [],
    npcs: [],
    shrines: [],
    camps: [],
    wildNPCs: [],
    spawnedTowerKeys: new Set(),
    discoveredWildChestKeys: new Set(),
    discoveredShrineKeys: new Set(),
    discoveredCampKeys: new Set(),
    discoveredWildNPCKeys: new Set(),
    ammoSpawnTimer: 5,
    chunkPruneTimer: 0,
};

export function initCanvas() {
    S.canvas = document.getElementById('gameCanvas');
    S.ctx = S.canvas.getContext('2d');
    S.ctx.imageSmoothingEnabled = false;
    resizeCanvas();
    window.addEventListener('resize', () => {
        resizeCanvas();
        if (S.player && S.currentState === GameState.PLAYING) {
            S.camera.x = S.player.x - S.canvas.width  / 2;
            S.camera.y = S.player.y - S.canvas.height / 2;
        }
    });
}

function resizeCanvas() {
    S.canvas.width  = window.innerWidth;
    S.canvas.height = window.innerHeight;
}
