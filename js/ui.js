// ============================================================
// UI  ─  minimap, dialogs, HUD, bestiary, class previews
// ============================================================
'use strict';
import { S, TILE_SIZE, TOWN_RADIUS, GameState } from './state.js';
import { TOWNS, ROAD_CONNECTIONS, MonsterTypes } from './world.js';
import { getBiomeAtWorld, Biomes } from './biomes.js';
import { questSystem } from './systems.js';
import { Classes, showFloatingText } from './entities.js';
import { achievements, ACHIEVEMENT_DEFS, setUnlockCallback } from './achievements.js';

// ── Minimap ──────────────────────────────────────────────────
let _minimapCanvas, _minimapCtx, _minimapFrame = 0;

export function renderMinimap() {
    if (!_minimapCanvas) {
        _minimapCanvas = document.getElementById('minimapCanvas');
        if (!_minimapCanvas) return;
        _minimapCtx = _minimapCanvas.getContext('2d');
    }
    _minimapFrame++;
    if (_minimapFrame%30!==0) return;
    const player = S.player;
    const mw=160, mh=120, WPP=30;
    _minimapCtx.fillStyle='#0a0a10'; _minimapCtx.fillRect(0,0,mw,mh);
    const sc=3;
    for (let my=0;my<mh;my+=sc) for (let mx=0;mx<mw;mx+=sc) {
        const wx=player.x+(mx-mw/2)*WPP, wy=player.y+(my-mh/2)*WPP;
        _minimapCtx.fillStyle=getBiomeAtWorld(wx,wy).minimapColor;
        _minimapCtx.fillRect(mx,my,sc,sc);
    }
    for (const [ai,bi] of ROAD_CONNECTIONS) {
        const ta=TOWNS[ai], tb=TOWNS[bi];
        const ax=mw/2+(ta.tileX*TILE_SIZE-player.x)/WPP, ay=mh/2+(ta.tileY*TILE_SIZE-player.y)/WPP;
        const bx=mw/2+(tb.tileX*TILE_SIZE-player.x)/WPP, by=mh/2+(tb.tileY*TILE_SIZE-player.y)/WPP;
        _minimapCtx.strokeStyle='rgba(160,130,80,0.45)'; _minimapCtx.lineWidth=1.5;
        _minimapCtx.beginPath(); _minimapCtx.moveTo(ax,ay); _minimapCtx.lineTo(bx,by); _minimapCtx.stroke();
    }
    for (const town of TOWNS) {
        const tx=mw/2+(town.tileX*TILE_SIZE-player.x)/WPP, ty=mh/2+(town.tileY*TILE_SIZE-player.y)/WPP;
        if (tx>=0&&tx<mw&&ty>=0&&ty<mh) {
            _minimapCtx.fillStyle='#FFD700'; _minimapCtx.fillRect(tx-3,ty-3,6,6);
            _minimapCtx.font='7px Courier New'; _minimapCtx.fillStyle='#FFD700'; _minimapCtx.textAlign='center'; _minimapCtx.fillText(town.name.slice(0,3),tx,ty-5); _minimapCtx.textAlign='left';
        }
    }
    for (const e of S.enemies) {
        const ex=mw/2+(e.x-player.x)/WPP, ey=mh/2+(e.y-player.y)/WPP;
        if (ex>=0&&ex<mw&&ey>=0&&ey<mh){ _minimapCtx.fillStyle=e.isBoss?'#ff0':e.color; _minimapCtx.fillRect(ex-1,ey-1,2,2); }
    }
    _minimapCtx.fillStyle='#fff'; _minimapCtx.fillRect(mw/2-3,mh/2-3,6,6);
    _minimapCtx.strokeStyle='rgba(255,255,255,0.15)'; _minimapCtx.lineWidth=1; _minimapCtx.strokeRect(0,0,mw,mh);
}

// ── Town Tracking ────────────────────────────────────────────
let _lastTownId = null;
export function checkTownProximity() {
    const player = S.player;
    for (const town of TOWNS) {
        const dist=Math.hypot(player.x-town.tileX*TILE_SIZE, player.y-town.tileY*TILE_SIZE);
        if (dist<TOWN_RADIUS) {
            questSystem.onVisitTown(town.id);
            achievements.recordTownVisit(town.id);
            if (_lastTownId!==town.id) {
                _lastTownId=town.id;
                showTownFlash(town);
                document.getElementById('biome-name-display').style.color='#FFD700';
                document.getElementById('biome-name-display').textContent=town.name;
            }
            return;
        }
    }
    _lastTownId=null;
}
export function resetTownTracking() { _lastTownId=null; }

let _townFlashTimeout=null;
export function showTownFlash(town) {
    const el=document.getElementById('town-flash');
    document.getElementById('town-flash-name').textContent=town.name.toUpperCase();
    document.getElementById('town-flash-subtitle').textContent=town.subtitle;
    el.classList.remove('hidden'); el.classList.add('visible');
    if (_townFlashTimeout) clearTimeout(_townFlashTimeout);
    _townFlashTimeout=setTimeout(()=>{ el.classList.remove('visible'); setTimeout(()=>el.classList.add('hidden'),600); },3500);
}

// ── NPC Dialogue ─────────────────────────────────────────────
export function showNPCDialogue(name, text, isMerchant) {
    S.currentState=GameState.PAUSED;
    document.getElementById('npc-dialog-name').textContent=(isMerchant?'[Merchant] ':'')+(name);
    document.getElementById('npc-dialog-text').textContent=text;
    document.getElementById('npc-dialog').classList.remove('hidden');
}
export function closeNPCDialogue() {
    document.getElementById('npc-dialog').classList.add('hidden');
    S.currentState=GameState.PLAYING;
    S.lastTime=performance.now();
}

// ── Biome display update ─────────────────────────────────────
let _lastBiomeId='';
export function updateBiomeDisplay() {
    const player = S.player;
    const biome=getBiomeAtWorld(player.x,player.y);
    questSystem.onVisitBiome(biome.id);
    achievements.recordBiomeVisit(biome.id);
    if (biome.id!==_lastBiomeId) {
        _lastBiomeId=biome.id;
        const el=document.getElementById('biome-name-display');
        el.style.color=biome.minimapColor;
        el.textContent=biome.name;
        showFloatingText(player.x,player.y-60,biome.name,biome.minimapColor);
    }
    const tx=Math.floor(player.x/TILE_SIZE), ty=Math.floor(player.y/TILE_SIZE);
    document.getElementById('coords-display').textContent=`Tile ${tx}, ${ty}`;
}
export function resetBiomeDisplay() { _lastBiomeId=''; }

// ── Quest Tracker ────────────────────────────────────────────
export function updateQuestTracker() {
    const el=document.getElementById('quest-list'); if(!el) return;
    el.innerHTML='';
    for (const q of questSystem.quests.slice(0,5)) {
        const div=document.createElement('div'); div.className='quest-item';
        const pct=Math.min(1,q.progress/q.required);
        let statusHTML;
        if (q.completed) {
            statusHTML = `<span>&#10003;</span>`;
        } else if (q.ready) {
            statusHTML = `<span style="color:#FFD700">TURN IN</span>`;
        } else {
            statusHTML = `<span>${q.progress}/${q.required}</span>`;
        }
        const titleCls = q.completed ? ' done' : (q.ready ? ' ready' : '');
        div.innerHTML=`<div class="quest-title-row${titleCls}"><span>${q.title}</span>${statusHTML}</div>${q.completed?'':`<div class="quest-prog-bar"><div class="quest-prog-fill" style="width:${Math.round(pct*100)}%"></div></div>`}${q.ready&&q.questGiver?`<div class="quest-giver-line">&rarr; ${q.questGiver}</div>`:''}`;
        el.appendChild(div);
    }
}

// ── HUD Update ───────────────────────────────────────────────
export function updateHUD() {
    const player = S.player;
    if (!player) return;
    document.getElementById('player-name-display').textContent=`${player.classType==='knight'?'Knight':player.classType==='wizard'?'Wizard':'Beast'} Lvl ${player.level}`;
    const hpPct=Math.max(0,player.hp/player.maxHp)*100;
    document.getElementById('hp-bar-fill').style.width=hpPct+'%';
    document.getElementById('hp-text').textContent=`${Math.ceil(player.hp)}/${player.maxHp}`;
    if (player.maxMana>0) {
        document.getElementById('mana-container').classList.remove('hidden');
        document.getElementById('mana-bar-fill').style.width=(player.mana/player.maxMana*100)+'%';
        document.getElementById('mana-text').textContent=`${Math.floor(player.mana)}/${player.maxMana}`;
    }
    document.getElementById('xp-bar-fill').style.width=(player.xp/player.xpToNext*100)+'%';
    document.getElementById('score-display').textContent=player.score;
    document.getElementById('level-display').textContent=player.level;
    const ammo=player.classType==='knight'?player.arrows:player.rocks;
    const ammoLabel=player.classType==='knight'?'Arrows':'Rocks';
    if (player.classType!=='wizard') {
        document.getElementById('ammo-display').classList.remove('hidden');
        document.getElementById('ammo-label').textContent=ammoLabel;
        document.getElementById('ammo-count').textContent=ammo;
    }
    const eq=player.equipment;
    if (eq.armor||eq.ring||eq.shield) {
        document.getElementById('equipment-display').classList.remove('hidden');
        document.getElementById('armor-display').textContent=eq.armor?eq.armor.name:'None'; document.getElementById('armor-display').style.color=eq.armor?eq.armor.color:'#555';
        document.getElementById('ring-display').textContent=eq.ring?eq.ring.name:'None'; document.getElementById('ring-display').style.color=eq.ring?eq.ring.color:'#555';
        document.getElementById('shield-display').textContent=eq.shield?eq.shield.name:'None'; document.getElementById('shield-display').style.color=eq.shield?eq.shield.color:'#555';
    }
    document.getElementById('stat-hp').textContent=player.maxHp;
    document.getElementById('stat-dmg').textContent=player.damage;
    document.getElementById('stat-spd').textContent=Math.round(player.speed);
    document.getElementById('stat-ability').textContent=player.abilityPower.toFixed(1);
    const cKey = player.classType==='knight'?'human':player.classType;
    document.getElementById('stat-ability-label').title=`${Classes[cKey]?.abilityName||'Power'}`;
}

// ── Bestiary populate ────────────────────────────────────────
export function buildBestiary() {
    const tbody=document.getElementById('bestiary-body'); if(!tbody) return;
    tbody.innerHTML='';
    MonsterTypes.forEach(m=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td style="color:${m.color};font-weight:bold">${m.isBoss?'[BOSS] ':''}${m.name}</td><td class="text-xs" style="color:#aaa">${m.biomes.join(', ')}</td><td>${m.speed>135?'Fast':(m.speed<75?'Slow':'Normal')}</td><td>${m.dmg>25?'High':m.dmg>12?'Med':'Low'}</td><td class="text-xs text-gray-400">${m.desc}</td>`;
        tbody.appendChild(tr);
    });
}

// ── Class Previews ───────────────────────────────────────────
export function drawClassPreviews() {
    function drawKnight(c){
        c.fillStyle='#CFD8DC';c.fillRect(46,6,4,28);c.fillStyle='#795548';c.fillRect(46,32,4,10);c.fillStyle='#9E9E9E';c.fillRect(40,31,16,4);
        c.fillStyle='#1565C0';c.beginPath();c.moveTo(6,26);c.lineTo(16,26);c.lineTo(16,44);c.lineTo(11,52);c.lineTo(6,44);c.closePath();c.fill();c.fillStyle='#FFD700';c.fillRect(9,28,2,18);c.fillRect(10,27,4,2);
        c.fillStyle='#546E7A';c.fillRect(20,44,8,12);c.fillRect(32,44,8,12);
        c.fillStyle='#78909C';c.fillRect(16,26,28,20);c.fillStyle='#90A4AE';c.fillRect(17,27,26,8);c.fillStyle='#607D8B';c.fillRect(10,24,8,8);c.fillRect(42,24,8,8);
        c.fillStyle='#607D8B';c.fillRect(18,8,24,18);c.fillStyle='#546E7A';c.fillRect(26,4,8,6);c.fillStyle='#37474F';c.fillRect(18,18,24,4);c.fillStyle='#E3F2FD';c.fillRect(20,19,7,2);c.fillRect(33,19,7,2);c.fillStyle='#455A64';c.fillRect(28,14,4,10);
    }
    function drawWizard(c){
        c.fillStyle='#6D4C41';c.fillRect(46,14,3,42);c.fillStyle='#00E5FF';c.beginPath();c.arc(47,10,7,0,Math.PI*2);c.fill();c.strokeStyle='rgba(0,229,255,0.4)';c.lineWidth=4;c.beginPath();c.arc(47,10,11,0,Math.PI*2);c.stroke();
        c.fillStyle='#7B1FA2';c.beginPath();c.moveTo(18,28);c.lineTo(8,56);c.lineTo(52,56);c.lineTo(42,28);c.closePath();c.fill();c.strokeStyle='#4A148C';c.lineWidth=1;c.stroke();
        c.fillStyle='#FFD700';c.fillRect(16,36,4,4);c.fillRect(30,44,4,4);c.fillRect(42,36,4,4);c.fillRect(22,48,4,4);c.fillRect(38,50,4,4);
        c.fillStyle='#FFE0B2';c.beginPath();c.arc(30,28,10,0,Math.PI*2);c.fill();c.fillStyle='#9E9E9E';c.fillRect(22,22,7,2);c.fillRect(31,22,7,2);c.fillStyle='#1A237E';c.fillRect(24,25,4,3);c.fillRect(32,25,4,3);c.fillStyle='#EEEEEE';c.fillRect(22,32,16,5);c.fillRect(24,37,12,3);
        c.fillStyle='#6A1B9A';c.fillRect(13,16,34,5);c.beginPath();c.moveTo(17,17);c.lineTo(30,1);c.lineTo(43,17);c.closePath();c.fill();c.fillStyle='#FFD700';c.fillRect(13,13,34,3);c.fillRect(27,6,6,2);c.fillRect(29,4,2,6);
    }
    function drawBeast(c){
        c.fillStyle='#FFCC80';c.fillRect(14,30,32,22);c.strokeStyle='#E65100';c.lineWidth=2;c.strokeRect(14,30,32,22);c.fillStyle='#FF8F00';c.fillRect(20,32,4,20);c.fillRect(36,32,4,20);
        c.fillStyle='#EF6C00';c.fillRect(16,50,10,8);c.fillRect(34,50,10,8);c.fillStyle='#FFF8E1';c.fillRect(14,57,3,3);c.fillRect(18,58,3,3);c.fillRect(22,57,3,3);c.fillRect(36,57,3,3);c.fillRect(40,58,3,3);c.fillRect(44,57,3,3);
        c.fillStyle='#FFCC80';c.fillRect(12,10,36,22);c.strokeStyle='#E65100';c.lineWidth=2;c.strokeRect(12,10,36,22);
        c.fillStyle='#EF6C00';c.beginPath();c.moveTo(12,10);c.lineTo(5,0);c.lineTo(20,10);c.closePath();c.fill();c.beginPath();c.moveTo(48,10);c.lineTo(55,0);c.lineTo(40,10);c.closePath();c.fill();
        c.fillStyle='#FF8A65';c.beginPath();c.moveTo(13,10);c.lineTo(8,3);c.lineTo(18,10);c.closePath();c.fill();c.beginPath();c.moveTo(47,10);c.lineTo(52,3);c.lineTo(42,10);c.closePath();c.fill();
        c.fillStyle='#FFAB40';c.fillRect(18,22,24,8);c.fillStyle='#4E342E';c.fillRect(26,22,8,5);
        c.fillStyle='#FF6F00';c.fillRect(14,12,10,8);c.fillRect(36,12,10,8);c.fillStyle='#212121';c.fillRect(18,13,2,7);c.fillRect(40,13,2,7);c.fillStyle='#FFF';c.fillRect(15,13,2,2);c.fillRect(37,13,2,2);
        c.fillStyle='#FFF';c.fillRect(22,29,3,4);c.fillRect(27,29,3,4);c.fillRect(33,29,3,4);c.fillRect(38,29,3,4);
    }
    document.querySelectorAll('.class-preview-canvas').forEach(pc=>{
        const c=pc.getContext('2d'); c.imageSmoothingEnabled=false; c.clearRect(0,0,60,60);
        if(pc.dataset.class==='human') drawKnight(c);
        else if(pc.dataset.class==='wizard') drawWizard(c);
        else drawBeast(c);
    });
}


// ── Achievement Toast Notification ───────────────────────────
const _toastQueue = [];
let _toastShowing = false;
function _enqueueToast(a) {
    _toastQueue.push(a);
    if (!_toastShowing) _showNextToast();
}
function _showNextToast() {
    if (_toastQueue.length === 0) { _toastShowing = false; return; }
    _toastShowing = true;
    const a = _toastQueue.shift();
    const el = document.getElementById('achievement-toast');
    if (!el) { _toastShowing = false; return; }
    document.getElementById('achievement-toast-icon').textContent = a.icon || '🏆';
    document.getElementById('achievement-toast-title').textContent = a.title;
    document.getElementById('achievement-toast-desc').textContent = a.desc;
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => {
        el.classList.remove('visible');
        setTimeout(() => { el.classList.add('hidden'); _showNextToast(); }, 600);
    }, 3500);
}

// Wire achievement-unlock callback to the toast system on module load.
setUnlockCallback(_enqueueToast);

// ── Achievements Screen (populates ach-list) ─────────────────
export function renderAchievementsScreen() {
    const list = document.getElementById('ach-list'); if (!list) return;
    list.innerHTML = '';
    const total = ACHIEVEMENT_DEFS.length;
    const unlocked = achievements.unlocked.length;
    document.getElementById('ach-progress').textContent = `${unlocked} / ${total} Unlocked`;
    for (const def of ACHIEVEMENT_DEFS) {
        const got = achievements.isUnlocked(def.id);
        const div = document.createElement('div');
        div.className = `ach-row ${got ? 'unlocked' : 'locked'}`;
        div.innerHTML = `
            <div class="ach-icon">${got ? def.icon : '🔒'}</div>
            <div class="ach-body">
                <div class="ach-title">${got ? def.title : '???'}</div>
                <div class="ach-desc">${def.desc}</div>
            </div>
        `;
        list.appendChild(div);
    }
    // Persistent stats line at top
    const stats = achievements.stats;
    document.getElementById('ach-stats-line').innerHTML =
        `<b>Total Kills:</b> ${stats.totalKills} &middot; ` +
        `<b>Chests:</b> ${stats.chestsOpened} &middot; ` +
        `<b>Quests:</b> ${stats.questsCompleted} &middot; ` +
        `<b>Highest Lvl:</b> ${stats.maxLevel} &middot; ` +
        `<b>Runs:</b> ${stats.runsStarted}`;
}
