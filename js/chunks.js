// ============================================================
// CHUNK SYSTEM
//   • On-demand chunk generation (supports millions of blocks)
//   • LRU cache with spatial distance pruning
//   • Off-screen canvas pre-rendering for fast frame draws
// ============================================================
'use strict';
import {
    S, TILE_SIZE, CHUNK_TILES, CHUNK_PX,
    CHUNK_CACHE_MAX, CHUNK_PRUNE_RADIUS, CHUNK_PRUNE_INTERVAL,
} from './state.js';
import { seededHash, getBiomeAtTile } from './biomes.js';
import { TOWNS, isRoadTile } from './world.js';

// ── Tree generation (deterministic from tile coords) ─────────
export function hasTreeAtTile(tx, ty) {
    if (Math.abs(tx) <= 5 && Math.abs(ty) <= 5) return false;
    for (const t of TOWNS) { if (Math.abs(tx-t.tileX)<22 && Math.abs(ty-t.tileY)<22) return false; }
    if (isRoadTile(tx, ty)) return false;
    const biome = getBiomeAtTile(tx, ty);
    return seededHash(tx*13+7, ty*19+3) < biome.treeChance;
}
export function getTreeWorldPos(tx, ty) {
    const ox = (seededHash(tx*2+1, ty*3+1) - 0.5) * TILE_SIZE * 0.55;
    const oy = (seededHash(tx*5+3, ty*7+5) - 0.5) * TILE_SIZE * 0.55;
    return { x: tx*TILE_SIZE + TILE_SIZE/2 + ox, y: ty*TILE_SIZE + TILE_SIZE/2 + oy };
}
export function getTreesNearPoint(cx, cy, radius) {
    const res = [];
    const tDist = Math.ceil(radius/TILE_SIZE) + 2;
    const ctX = Math.floor(cx/TILE_SIZE), ctY = Math.floor(cy/TILE_SIZE);
    for (let dy=-tDist; dy<=tDist; dy++) for (let dx=-tDist; dx<=tDist; dx++) {
        const tx=ctX+dx, ty=ctY+dy;
        if (hasTreeAtTile(tx,ty)) {
            const p = getTreeWorldPos(tx,ty);
            if (Math.hypot(p.x-cx,p.y-cy) <= radius+TILE_SIZE) res.push(p);
        }
    }
    return res;
}

// ── Tile/road/tree/building drawing (to offscreen ctx) ───────
function renderTileToCtx(oc, sx, sy, tx, ty, biome) {
    const h = seededHash(tx*3+1, ty*7+2);
    oc.fillStyle = biome.tileColors[Math.floor(h * biome.tileColors.length)];
    oc.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);

    const d = seededHash(tx*13+5, ty*17+3);
    if (d > 0.93) {
        if (biome.id==='plains') {
            oc.fillStyle = '#ffe566'; oc.fillRect(sx+Math.floor(d*22), sy+Math.floor(seededHash(tx,ty)*18), 2, 2);
        } else if (biome.id==='desert') {
            oc.fillStyle='rgba(150,120,60,0.35)'; oc.fillRect(sx+4,sy+14,24,2); oc.fillRect(sx+8,sy+22,16,2);
        } else if (biome.id==='tundra') {
            oc.strokeStyle='rgba(180,215,245,0.5)'; oc.lineWidth=1;
            oc.beginPath(); oc.moveTo(sx+16,sy+6); oc.lineTo(sx+16,sy+26);
            oc.moveTo(sx+6,sy+16); oc.lineTo(sx+26,sy+16); oc.stroke();
        } else if (biome.id==='ruins') {
            oc.strokeStyle='rgba(0,0,0,0.25)'; oc.lineWidth=1;
            oc.beginPath(); oc.moveTo(sx+4,sy+4); oc.lineTo(sx+22,sy+28); oc.stroke();
        } else if (biome.id==='volcanic') {
            oc.fillStyle='rgba(255,60,0,0.55)';
            oc.beginPath(); oc.arc(sx+16,sy+20,5,0,Math.PI*2); oc.fill();
        } else if (biome.id==='void') {
            oc.fillStyle='rgba(80,80,200,0.4)';
            oc.fillRect(sx+Math.floor(d*26),sy+Math.floor(seededHash(tx*2,ty*2)*22),2,2);
        }
    }
    oc.fillStyle = 'rgba(0,0,0,0.04)';
    oc.fillRect(sx, sy, TILE_SIZE, 1);
    oc.fillRect(sx, sy, 1, TILE_SIZE);
}

function renderRoadTileToCtx(oc, sx, sy) {
    oc.fillStyle = 'rgba(150,120,80,0.55)';
    oc.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    oc.fillStyle = 'rgba(120,95,60,0.2)';
    oc.fillRect(sx+6,sy+12,TILE_SIZE-12,2);
    oc.fillRect(sx+6,sy+20,TILE_SIZE-12,2);
}

function drawTreeToCtx(oc, sx, sy, biome) {
    const tH = TILE_SIZE * 0.45, cR = TILE_SIZE * 0.55;
    if (biome.id==='tundra') {
        oc.fillStyle='#2d5a1a';
        oc.beginPath(); oc.moveTo(sx,sy-tH-cR); oc.lineTo(sx+cR,sy-tH+cR*0.5); oc.lineTo(sx-cR,sy-tH+cR*0.5); oc.fill();
        oc.fillStyle='rgba(200,225,245,0.5)';
        oc.beginPath(); oc.moveTo(sx,sy-tH-cR); oc.lineTo(sx+cR*0.5,sy-tH-cR*0.3); oc.lineTo(sx-cR*0.5,sy-tH-cR*0.3); oc.fill();
        oc.fillStyle='#4a3020'; oc.fillRect(sx-2,sy-tH,4,tH+4);
    } else if (biome.id==='desert') {
        oc.fillStyle='#4a7a30';
        oc.fillRect(sx-4,sy-tH*2,8,tH*2);
        oc.fillRect(sx-12,sy-tH*1.3,8,5); oc.fillRect(sx+4,sy-tH*1.1,8,5);
        oc.fillRect(sx-12,sy-tH*1.3-5,4,8); oc.fillRect(sx+8,sy-tH*1.1-5,4,8);
    } else if (biome.id==='bog') {
        oc.fillStyle='#4a3520'; oc.fillRect(sx-3,sy-tH*1.6,6,tH*1.6);
        oc.fillRect(sx-14,sy-tH,28,4);
        oc.fillStyle='rgba(60,90,40,0.38)'; oc.beginPath(); oc.arc(sx,sy-tH,cR*0.7,0,Math.PI*2); oc.fill();
    } else if (biome.id==='volcanic') {
        oc.fillStyle='#1a0a00'; oc.fillRect(sx-3,sy-tH*1.8,6,tH*1.8);
        oc.fillStyle='#2a0c00'; oc.fillRect(sx-10,sy-tH*1.5,20,3); oc.fillRect(sx-6,sy-tH*1.2,12,3);
    } else if (biome.id==='ruins') {
        oc.fillStyle='#4a4038'; oc.fillRect(sx-3,sy-tH*1.5,6,tH*1.5);
        oc.fillStyle='rgba(70,60,50,0.45)'; oc.beginPath(); oc.arc(sx,sy-tH,cR*0.8,0,Math.PI*2); oc.fill();
    } else {
        oc.fillStyle='rgba(0,0,0,0.18)'; oc.beginPath(); oc.ellipse(sx+3,sy+3,cR*0.9,cR*0.42,0,0,Math.PI*2); oc.fill();
        oc.fillStyle='#5D4037'; oc.fillRect(sx-4,sy-tH,8,tH+4);
        const isDark = biome.id==='forest';
        oc.fillStyle=isDark?'#1B5E20':'#33691E';
        oc.beginPath(); oc.arc(sx,sy-tH-4,cR,0,Math.PI*2); oc.fill();
        oc.fillStyle=isDark?'#2E7D32':'#558B2F';
        oc.beginPath(); oc.arc(sx-4,sy-tH-6,cR*0.72,0,Math.PI*2); oc.fill();
        oc.fillStyle=isDark?'#388E3C':'#689F38';
        oc.beginPath(); oc.arc(sx+5,sy-tH-4,cR*0.60,0,Math.PI*2); oc.fill();
    }
}

function drawBuildingToCtx(oc, bx, by, bw, bh, type, label) {
    oc.fillStyle='rgba(0,0,0,0.32)'; oc.fillRect(bx+5,by+5,bw,bh);
    const wallColors = { house:['#7a6a55','#8a7a65'], inn:['#6a5040','#7a6050'], shop:['#7a5a30','#8a6a40'], townhall:['#888070','#9a9080'], tower:['#585868','#686878'] };
    const [wDark,wLight] = wallColors[type]||['#666','#777'];
    oc.fillStyle=wDark; oc.fillRect(bx,by,bw,bh);
    oc.fillStyle=wLight;
    for (let row=0; row<bh; row+=10) { oc.fillRect(bx+2,by+row+1,bw-4,6); }
    const wt=7;
    oc.fillStyle=type==='inn'?'#3c2a1a':type==='shop'?'#302820':'#382e24';
    oc.fillRect(bx+wt,by+wt,bw-wt*2,bh-wt*2);
    oc.strokeStyle='rgba(255,255,255,0.04)'; oc.lineWidth=0.5;
    for (let r=by+wt; r<by+bh-wt; r+=14) { oc.beginPath(); oc.moveTo(bx+wt,r); oc.lineTo(bx+bw-wt,r); oc.stroke(); }
    for (let c=bx+wt; c<bx+bw-wt; c+=14) { oc.beginPath(); oc.moveTo(c,by+wt); oc.lineTo(c,by+bh-wt); oc.stroke(); }
    oc.fillStyle='#ffe082';
    const numW = Math.max(1, Math.floor(bw/TILE_SIZE)-1);
    for (let i=0;i<numW;i++) {
        const wx = bx+wt+Math.floor((i+0.5)*(bw-wt*2)/numW)-4;
        oc.fillRect(wx,by+wt+2,8,6);
        oc.fillStyle='rgba(0,0,0,0.35)'; oc.fillRect(wx+3,by+wt+2,1.5,6); oc.fillRect(wx,by+wt+4,8,1);
        oc.fillStyle='#ffe082';
    }
    const dw=10, dh=wt+2, dx=bx+bw/2-dw/2, dy=by+bh-dh;
    oc.fillStyle='#1a1205'; oc.fillRect(dx,dy,dw,dh+2);
    oc.fillStyle='#c8a050'; oc.fillRect(dx+dw-4,dy+3,2,4);
    oc.strokeStyle='rgba(0,0,0,0.7)'; oc.lineWidth=2; oc.strokeRect(bx,by,bw,bh);
    if (label) {
        oc.font='bold 9px Courier New';
        const tw=oc.measureText(label).width;
        oc.fillStyle='rgba(0,0,0,0.8)'; oc.fillRect(bx+bw/2-tw/2-3,by-16,tw+6,13);
        oc.fillStyle='#FFD700'; oc.textAlign='center'; oc.fillText(label,bx+bw/2,by-6); oc.textAlign='left';
    }
}

// ── LRU chunk cache ──────────────────────────────────────────
//
// Map preserves insertion order — we treat the front as LRU and
// the back as MRU. On hit, we `delete` + `set` to touch the entry.
// On overflow, we evict the oldest entry until below cap.
// Periodically we also prune chunks far from the camera.
export const chunkCache = new Map();

export function clearChunkCache() { chunkCache.clear(); }

function _touch(key, value) {
    chunkCache.delete(key);
    chunkCache.set(key, value);
}

function _evictOldest(count) {
    const it = chunkCache.keys();
    for (let i=0; i<count; i++) {
        const k = it.next().value;
        if (k === undefined) break;
        chunkCache.delete(k);
    }
}

// Prune chunks whose (cx,cy) is farther than CHUNK_PRUNE_RADIUS
// from the current camera-center chunk. Lets the player travel
// arbitrarily far without unbounded memory growth.
export function pruneDistantChunks() {
    if (!S.canvas) return;
    const ccX = Math.floor((S.camera.x + S.canvas.width/2)  / CHUNK_PX);
    const ccY = Math.floor((S.camera.y + S.canvas.height/2) / CHUNK_PX);
    for (const k of chunkCache.keys()) {
        const idx = k.indexOf(',');
        const cx = +k.slice(0, idx), cy = +k.slice(idx+1);
        if (Math.abs(cx-ccX) > CHUNK_PRUNE_RADIUS || Math.abs(cy-ccY) > CHUNK_PRUNE_RADIUS) {
            chunkCache.delete(k);
        }
    }
}

function getOrCreateChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (chunkCache.has(key)) {
        const v = chunkCache.get(key);
        _touch(key, v);
        return v;
    }

    const oc = (typeof OffscreenCanvas!=='undefined')
        ? new OffscreenCanvas(CHUNK_PX, CHUNK_PX)
        : (() => { const c=document.createElement('canvas'); c.width=c.height=CHUNK_PX; return c; })();
    const oc2 = oc.getContext('2d');
    oc2.imageSmoothingEnabled = false;

    // 1. Terrain tiles
    for (let ty=0;ty<CHUNK_TILES;ty++) for (let tx=0;tx<CHUNK_TILES;tx++) {
        const wx=cx*CHUNK_TILES+tx, wy=cy*CHUNK_TILES+ty;
        const biome = getBiomeAtTile(wx,wy);
        renderTileToCtx(oc2, tx*TILE_SIZE, ty*TILE_SIZE, wx, wy, biome);
    }
    // 2. Roads
    for (let ty=0;ty<CHUNK_TILES;ty++) for (let tx=0;tx<CHUNK_TILES;tx++) {
        const wx=cx*CHUNK_TILES+tx, wy=cy*CHUNK_TILES+ty;
        if (isRoadTile(wx,wy)) renderRoadTileToCtx(oc2, tx*TILE_SIZE, ty*TILE_SIZE);
    }
    // 3. Trees (slight overscan for overhanging canopies)
    for (let ty=-2;ty<CHUNK_TILES+2;ty++) for (let tx=-2;tx<CHUNK_TILES+2;tx++) {
        const wx=cx*CHUNK_TILES+tx, wy=cy*CHUNK_TILES+ty;
        if (hasTreeAtTile(wx,wy)) {
            const pos = getTreeWorldPos(wx,wy);
            const biome = getBiomeAtTile(wx,wy);
            drawTreeToCtx(oc2, pos.x-cx*CHUNK_PX, pos.y-cy*CHUNK_PX, biome);
        }
    }
    // 4. Town buildings overlapping this chunk
    for (const town of TOWNS) {
        for (const b of town.buildings) {
            const bPX=(town.tileX+b.tx)*TILE_SIZE, bPY=(town.tileY+b.ty)*TILE_SIZE;
            const bW=b.tw*TILE_SIZE, bH=b.th*TILE_SIZE;
            const cpX=cx*CHUNK_PX, cpY=cy*CHUNK_PX;
            if (bPX+bW>=cpX && bPX<=cpX+CHUNK_PX && bPY+bH>=cpY && bPY<=cpY+CHUNK_PX)
                drawBuildingToCtx(oc2, bPX-cpX, bPY-cpY, bW, bH, b.type, b.label||'');
        }
    }

    chunkCache.set(key, oc);
    if (chunkCache.size > CHUNK_CACHE_MAX) {
        _evictOldest(chunkCache.size - CHUNK_CACHE_MAX);
    }
    return oc;
}

export function renderTerrain() {
    const { ctx, camera, canvas } = S;
    const cXmin=Math.floor(camera.x/CHUNK_PX)-1, cXmax=Math.ceil((camera.x+canvas.width)/CHUNK_PX)+1;
    const cYmin=Math.floor(camera.y/CHUNK_PX)-1, cYmax=Math.ceil((camera.y+canvas.height)/CHUNK_PX)+1;
    for (let cy=cYmin;cy<=cYmax;cy++) for (let cx=cXmin;cx<=cXmax;cx++) {
        const cc=getOrCreateChunk(cx,cy);
        ctx.drawImage(cc, cx*CHUNK_PX-camera.x, cy*CHUNK_PX-camera.y);
    }
}

// Pre-render a static menu background using cached chunks near origin
export function drawMenuBackground() {
    const { ctx, canvas } = S;
    ctx.fillStyle='#0a0a0f'; ctx.fillRect(0,0,canvas.width,canvas.height);
    for (let cy=-2;cy<=3;cy++) for (let cx=-2;cx<=3;cx++) {
        const cc=getOrCreateChunk(cx,cy);
        ctx.globalAlpha=0.35;
        ctx.drawImage(cc, cx*CHUNK_PX-canvas.width*0.5+canvas.width/2, cy*CHUNK_PX-canvas.height*0.5+canvas.height/2);
        ctx.globalAlpha=1;
    }
    ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(0,0,canvas.width,canvas.height);
}
