// ============================================================
// SEEDED NOISE  +  BIOME MAP
// Pure deterministic functions of (tileX, tileY) — supports
// an infinite, seed-stable world for "millions of blocks".
// ============================================================
'use strict';
import { WORLD_SEED, TILE_SIZE, BIOME_CACHE_MAX } from './state.js';

// ── Noise ────────────────────────────────────────────────────
export function seededHash(a, b) {
    let n = Math.imul(a * 374761393 ^ b * 668265263, WORLD_SEED | 1);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function smoothNoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
    const a = seededHash(ix,   iy),   b = seededHash(ix+1, iy);
    const c = seededHash(ix,   iy+1), d = seededHash(ix+1, iy+1);
    return a*(1-ux)*(1-uy) + b*ux*(1-uy) + c*(1-ux)*uy + d*ux*uy;
}
export function octaveNoise(x, y, oct = 4) {
    let v=0, amp=1, freq=1, max=0;
    for (let i=0;i<oct;i++){ v+=smoothNoise(x*freq,y*freq)*amp; max+=amp; amp*=0.5; freq*=2; }
    return v / max;
}

// ── Biomes ───────────────────────────────────────────────────
export const Biomes = {
    PLAINS:   { id:'plains',   name:'Ticklegrass Plains',              minimapColor:'#3d6b28', tileColors:['#4a8c3f','#5a9c4f','#3e7a35','#508a42'], treeChance:0.04,  difficulty:1 },
    FOREST:   { id:'forest',   name:'Murmuring Murk',                  minimapColor:'#163016', tileColors:['#1e4a1e','#263c26','#1a3818','#2a4422'], treeChance:0.30,  difficulty:2 },
    DESERT:   { id:'desert',   name:'The Sandy Bits',                  minimapColor:'#b09040', tileColors:['#c4a04a','#d0b05a','#b89040','#c8a850'], treeChance:0.008, difficulty:3 },
    BOG:      { id:'bog',      name:'Soggy Bog of Despair',            minimapColor:'#2e3e1c', tileColors:['#354528','#2e3c22','#3e4e2e','#2a3818'], treeChance:0.12,  difficulty:3 },
    TUNDRA:   { id:'tundra',   name:'Frostbitten Tundra',              minimapColor:'#90a8bc', tileColors:['#b0c8d8','#c0d8e8','#a0b8cc','#c8dce8'], treeChance:0.07,  difficulty:4 },
    RUINS:    { id:'ruins',    name:'Ruins of Wobblethwaite',          minimapColor:'#585050', tileColors:['#6a6050','#5a5040','#7a7060','#5e5448'], treeChance:0.06,  difficulty:4 },
    VOLCANIC: { id:'volcanic', name:'Doom Fields of Questionable Lava',minimapColor:'#5a1000', tileColors:['#2a1206','#1c0c04','#381808','#28100a'], treeChance:0.003, difficulty:5 },
    VOID:     { id:'void',     name:'Void of Questionable Decisions',  minimapColor:'#080820', tileColors:['#050510','#080818','#040410','#0a0a20'], treeChance:0,     difficulty:6 },
};

// LRU-style biome cache (Map preserves insertion order)
export const _biomeCache = new Map();

export function getBiomeAtTile(tx, ty) {
    const key = `${tx},${ty}`;
    if (_biomeCache.has(key)) {
        const v = _biomeCache.get(key);
        _biomeCache.delete(key); _biomeCache.set(key, v); // touch as MRU
        return v;
    }
    const dist = Math.sqrt(tx*tx + ty*ty);
    let biome;
    if (dist < 80) {
        biome = Biomes.PLAINS;
    } else if (dist >= 3000) {
        biome = Biomes.VOID;
    } else if (dist >= 1500) {
        const h = octaveNoise(tx*0.004+300, ty*0.004+300, 3);
        biome = h > 0.5 ? Biomes.VOLCANIC : Biomes.RUINS;
    } else if (dist >= 800) {
        const cold = octaveNoise(tx*0.005+500, ty*0.005+500, 3);
        if (cold < 0.38) biome = Biomes.TUNDRA;
        else biome = octaveNoise(tx*0.005+200, ty*0.005+800, 3) > 0.5 ? Biomes.RUINS : Biomes.BOG;
    } else {
        const elev = octaveNoise(tx*0.006, ty*0.006, 4);
        const mois = octaveNoise(tx*0.006+1000, ty*0.006+1000, 4);
        if (elev < 0.35) biome = mois < 0.45 ? Biomes.DESERT : Biomes.BOG;
        else if (mois > 0.6) biome = Biomes.FOREST;
        else if (elev > 0.7) biome = Biomes.RUINS;
        else biome = Biomes.PLAINS;
    }
    if (_biomeCache.size > BIOME_CACHE_MAX) {
        // Evict ~10% LRU when cap exceeded (cheaper than clearing)
        const toEvict = Math.floor(BIOME_CACHE_MAX * 0.1);
        const it = _biomeCache.keys();
        for (let i=0; i<toEvict; i++) _biomeCache.delete(it.next().value);
    }
    _biomeCache.set(key, biome);
    return biome;
}

export function getBiomeAtWorld(wx, wy) {
    return getBiomeAtTile(Math.floor(wx / TILE_SIZE), Math.floor(wy / TILE_SIZE));
}
