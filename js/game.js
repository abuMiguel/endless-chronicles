// ============================================================
// GAME LOOP + STATE TRANSITIONS
// ============================================================
'use strict';
import {
    S, GameState, TILE_SIZE, CHUNK_PRUNE_INTERVAL,
} from './state.js';
import { getBiomeAtWorld, _biomeCache } from './biomes.js';
import { TOWNS, CHEST_SPAWN_DATA, DEATH_QUOTES } from './world.js';
import { renderTerrain, pruneDistantChunks, clearChunkCache } from './chunks.js';
import { Player, Classes, NPC, ArcherTower } from './entities.js';
import { spawnManager, questSystem, deleteSaveGame } from './systems.js';
import { achievements } from './achievements.js';
import {
    updateHUD, updateQuestTracker, renderMinimap, checkTownProximity,
    updateBiomeDisplay, resetBiomeDisplay, resetTownTracking, showNPCDialogue,
} from './ui.js';
import { showFloatingText } from './entities.js';

// ── Start / pause / resume ───────────────────────────────────
export function startGame(className, loadedData=null) {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('mobile-controls').classList.remove('hidden');
    document.getElementById('action-btn').classList.remove('hidden');
    document.getElementById('ranged-btn').classList.remove('hidden');
    document.getElementById('minimap-wrap').classList.remove('hidden');

    if (loadedData) {
        S.player = new Player(Classes[loadedData.classType]);
        Object.assign(S.player, loadedData.player);
    } else {
        S.player = new Player(Classes[className]);
    }

    const cKey = S.player.classType==='wizard' ? 'wizard' : (S.player.classType==='knight' ? 'human' : 'beast');
    document.getElementById('ability-upgrade-btn').innerText=`+ Improve ${Classes[cKey].abilityName}`;

    // Spawn NPCs from towns
    S.npcs.length = 0;
    for (const town of TOWNS) {
        for (const npcData of town.npcs) {
            const wx=(town.tileX+npcData.tx)*TILE_SIZE;
            const wy=(town.tileY+npcData.ty)*TILE_SIZE;
            S.npcs.push(new NPC(wx,wy,npcData));
        }
    }

    S.enemies.length=0; S.projectiles.length=0; S.particles.length=0;
    S.items.length=0; S.floatTexts.length=0;
    S.chests = CHEST_SPAWN_DATA.map(pos=>({x:pos.x,y:pos.y,opened:false,loot:pos.loot}));
    S.archerTowers.length=0; S.spawnedTowerKeys.clear();
    spawnManager.spawnTimer=0; spawnManager.lastBossLevel=0; spawnManager.bossSpawned=false;
    spawnManager.snorflaxiaSpawned=false; spawnManager.voidAddTimer=0;
    S.ammoSpawnTimer=5;
    S.chunkPruneTimer=0;
    questSystem.init();
    resetBiomeDisplay(); resetTownTracking();
    clearChunkCache(); _biomeCache.clear();
    achievements.recordRunStart();
    updateHUD(); updateQuestTracker();
    S.currentState=GameState.PLAYING;
    S.lastTime=performance.now();
    cancelAnimationFrame(S.animationFrameId);
    gameLoop(performance.now());

    setTimeout(()=>{ showFloatingText(S.player.x,S.player.y-100,'Welcome to Grumbleshire!','#FFD700'); },800);
}

export function pauseGame() {
    S.currentState=GameState.PAUSED;
    document.getElementById('pause-menu').classList.remove('hidden');
    document.getElementById('save-msg').innerText='';
}

export function resumeGame() {
    S.currentState=GameState.PLAYING;
    document.getElementById('pause-menu').classList.add('hidden');
    S.lastTime=performance.now();
    cancelAnimationFrame(S.animationFrameId);
    gameLoop(performance.now());
}

export function triggerLevelUpScreen() {
    const player = S.player;
    S.currentState=GameState.LEVEL_UP;
    document.getElementById('new-level-display').innerText=player.level;
    document.querySelector('[data-stat="maxHp"]').innerText=`❤ Vitality  — Max HP ${player.maxHp} → ${player.maxHp+25}`;
    document.querySelector('[data-stat="damage"]').innerText=`⚔ Strength  — Damage ${player.damage} → ${player.damage+5}`;
    document.querySelector('[data-stat="speed"]').innerText=`⚡ Agility   — Speed ${Math.round(player.speed)} → ${Math.round(player.speed+10)}`;
    const abilBtn=document.querySelector('[data-stat="ability"]');
    if (player.classType==='wizard') abilBtn.innerText=`🔮 Arcane  — Mana ${player.maxMana}→${player.maxMana+30}, Regen +2/s`;
    else if (player.classType==='knight') abilBtn.innerText=`🛡 Block — ${player.abilityPower.toFixed(1)}→${(player.abilityPower+0.2).toFixed(1)}x mitigation`;
    else abilBtn.innerText=`🐾 Fury  — ${player.abilityPower.toFixed(1)}→${(player.abilityPower+0.5).toFixed(1)}x lifesteal/crit`;
    document.getElementById('level-up-screen').classList.remove('hidden');
}

export function gameOver(killerName=null) {
    const player = S.player;
    S.currentState=GameState.GAME_OVER;
    achievements.recordRunDeath();
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('mobile-controls').classList.add('hidden');
    document.getElementById('action-btn').classList.add('hidden');
    document.getElementById('ranged-btn').classList.add('hidden');
    document.getElementById('minimap-wrap').classList.add('hidden');
    document.getElementById('death-level').innerText=player.level;
    document.getElementById('death-score').innerText=player.score;
    document.getElementById('death-kills').innerText=player.kills;
    document.getElementById('death-killer').innerText=killerName||'Unknown Peril';
    document.getElementById('death-quote').innerText=DEATH_QUOTES[Math.floor(Math.random()*DEATH_QUOTES.length)];
    document.getElementById('game-over-screen').classList.remove('hidden');
    deleteSaveGame();
}

export function returnToMenu() {
    S.currentState=GameState.MENU;
    cancelAnimationFrame(S.animationFrameId);
    ['pause-menu','game-over-screen','victory-screen','hud','mobile-controls','action-btn','ranged-btn','minimap-wrap','town-flash'].forEach(id=>{
        document.getElementById(id)?.classList.add('hidden');
    });
    document.getElementById('start-screen').classList.remove('hidden');
    const { ctx, canvas } = S;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#0a0a0f'; ctx.fillRect(0,0,canvas.width,canvas.height);
}

// ── Victory (Snorflaxia defeated) ────────────────────────────
const VICTORY_QUOTES = [
    '"Two hundred years of waiting, and you ended it in an afternoon. Rude."',
    '"The Realm of Grumbleshire is mildly grateful. Gerald the Frog is moderately so."',
    '"Bert\'s cabbages remain unguarded, but the Void is sealed. Net positive."',
    '"You did it. Now go home and rest. The bog can wait."',
];
export function triggerVictory() {
    const player = S.player;
    S.currentState = GameState.GAME_OVER;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('mobile-controls').classList.add('hidden');
    document.getElementById('action-btn').classList.add('hidden');
    document.getElementById('ranged-btn').classList.add('hidden');
    document.getElementById('minimap-wrap').classList.add('hidden');
    document.getElementById('victory-level').innerText = player.level;
    document.getElementById('victory-score').innerText = player.score;
    document.getElementById('victory-kills').innerText = player.kills;
    document.getElementById('victory-quote').innerText = VICTORY_QUOTES[Math.floor(Math.random()*VICTORY_QUOTES.length)];
    document.getElementById('victory-screen').classList.remove('hidden');
    deleteSaveGame();
}

// ── Main game loop ───────────────────────────────────────────
export function gameLoop(timestamp) {
    const { ctx, canvas, camera } = S;
    const dt=Math.min((timestamp-S.lastTime)/1000, 0.1);
    S.lastTime=timestamp;

    if (S.currentState===GameState.PLAYING) {
        const player = S.player;
        player.update(dt);
        spawnManager.update(dt);
        questSystem.tick();
        checkTownProximity();
        updateBiomeDisplay();

        // Periodic spatial chunk pruning for unbounded exploration
        S.chunkPruneTimer += dt;
        if (S.chunkPruneTimer >= CHUNK_PRUNE_INTERVAL) {
            pruneDistantChunks();
            S.chunkPruneTimer = 0;
        }

        S.ammoSpawnTimer-=dt;
        if (S.ammoSpawnTimer<=0) {
            const a=Math.random()*Math.PI*2, d=200+Math.random()*300;
            const biome=getBiomeAtWorld(player.x,player.y);
            const ammoType=biome.id==='desert'||biome.id==='ruins'?'rock':'arrow';
            S.items.push({ x:player.x+Math.cos(a)*d, y:player.y+Math.sin(a)*d, size:8, ammoType, ammoCount:3+Math.floor(Math.random()*4), life:20, bob:Math.random()*Math.PI*2 });
            S.ammoSpawnTimer=5+Math.random()*5;
        }

        for (let i=S.enemies.length-1;i>=0;i--) {
            S.enemies[i].update(dt);
            if (S.enemies[i].hp<=0) S.enemies.splice(i,1);
        }
        for (let i=S.projectiles.length-1;i>=0;i--) { if(S.projectiles[i].update(dt)) S.projectiles.splice(i,1); }
        for (const n of S.npcs) n.update(dt);
        for (let i=S.archerTowers.length-1;i>=0;i--) { S.archerTowers[i].update(dt); if(S.archerTowers[i].dead) S.archerTowers.splice(i,1); }

        // Items
        for (let i=S.items.length-1;i>=0;i--) {
            const item=S.items[i]; item.life-=dt; item.bob+=dt*3;
            if (item.life<=0){ S.items.splice(i,1); continue; }
            const dist=Math.hypot(player.x-item.x,player.y-item.y);
            if (dist<28) {
                if (item.heal) player.heal(item.heal);
                else if (item.ammoType) {
                    if(item.ammoType==='arrow') player.arrows+=item.ammoCount;
                    else player.rocks+=item.ammoCount;
                    showFloatingText(item.x,item.y-10,`+${item.ammoCount} ${item.ammoType==='arrow'?'Arrows':'Rocks'}`,'#FFD700');
                    updateHUD();
                }
                S.items.splice(i,1);
            }
        }

        // Chests
        for (const chest of S.chests) {
            if (chest.opened) continue;
            if (Math.hypot(player.x-chest.x,player.y-chest.y)<38) {
                chest.opened=true;
                const loot=chest.loot;
                if (loot) {
                    if (loot.slot==='armor'&&!player.equipment.armor) { player.equipment.armor=loot; showFloatingText(chest.x,chest.y-30,`Got: ${loot.name}!`,loot.color); updateHUD(); }
                    else if (loot.slot==='ring'&&!player.equipment.ring) { player.equipment.ring=loot; showFloatingText(chest.x,chest.y-30,`Got: ${loot.name}!`,loot.color); updateHUD(); }
                    else if (loot.slot==='shield'&&!player.equipment.shield) { player.equipment.shield=loot; showFloatingText(chest.x,chest.y-30,`Got: ${loot.name}!`,loot.color); updateHUD(); }
                    else { const bonus=20+Math.floor(Math.random()*30); player.score+=bonus; showFloatingText(chest.x,chest.y-30,`+${bonus} Gold!`,'#FFD700'); }
                }
                questSystem.onOpenChest();
                achievements.recordChestOpen();
                updateQuestTracker();
            }
        }

        // Archer Tower spawns near towns
        for (const town of TOWNS) {
            if (Math.hypot(player.x-town.tileX*TILE_SIZE,player.y-town.tileY*TILE_SIZE)<600) {
                const key=`tower_${town.id}`;
                if (!S.spawnedTowerKeys.has(key)) {
                    S.spawnedTowerKeys.add(key);
                    const tx=(town.tileX+12)*TILE_SIZE, ty=(town.tileY-8)*TILE_SIZE;
                    S.archerTowers.push(new ArcherTower(tx,ty));
                    const tx2=(town.tileX-12)*TILE_SIZE, ty2=(town.tileY+6)*TILE_SIZE;
                    S.archerTowers.push(new ArcherTower(tx2,ty2));
                }
            }
        }

        // F key NPC interaction (talk OR turn in quest if ready)
        if (S.keys['f']||S.keys['F']) {
            S.keys['f']=false; S.keys['F']=false;
            for (const n of S.npcs) {
                if (Math.hypot(player.x-n.x,player.y-n.y)<70) {
                    const readyQuest = questSystem.readyQuestForNPC(n.name);
                    if (readyQuest) {
                        // Turn in flow — complete the quest then show success dialog.
                        const completedTitle = readyQuest.title;
                        const completedReward = readyQuest.rewardText;
                        questSystem.complete(readyQuest);
                        showNPCDialogue(
                            n.name,
                            `"Quest complete: ${completedTitle}. Reward: ${completedReward}. Now go away, I have things to do."`,
                            n.isMerchant
                        );
                    } else {
                        const line=n.dialogue[n.dialogueIndex%n.dialogue.length]; n.dialogueIndex++;
                        showNPCDialogue(n.name, line, n.isMerchant);
                    }
                    break;
                }
            }
        }
    }

    // RENDER
    ctx.clearRect(0,0,canvas.width,canvas.height);
    renderTerrain();

    if (S.currentState!==GameState.MENU && S.player) {
        const player = S.player;
        const currentBiome=getBiomeAtWorld(player.x,player.y);
        if (currentBiome.id==='volcanic') {
            ctx.fillStyle=`rgba(180,50,0,${0.04+Math.sin(Date.now()/700)*0.015})`;
            ctx.fillRect(0,0,canvas.width,canvas.height);
        } else if (currentBiome.id==='void') {
            ctx.fillStyle=`rgba(10,0,50,${0.08+Math.sin(Date.now()/500)*0.02})`;
            ctx.fillRect(0,0,canvas.width,canvas.height);
        } else if (currentBiome.id==='tundra') {
            ctx.fillStyle='rgba(180,210,240,0.03)';
            ctx.fillRect(0,0,canvas.width,canvas.height);
        }

        for (const item of S.items) {
            const dx=item.x-camera.x, dy=item.y-camera.y;
            const bob=Math.sin(item.bob)*4;
            ctx.globalAlpha=Math.min(1,item.life*0.8);
            if (item.heal) {
                ctx.fillStyle='#F44336'; ctx.beginPath(); ctx.arc(dx,dy-3+bob,7,0,Math.PI*2); ctx.fill();
                ctx.fillStyle='#fff'; ctx.fillRect(dx-1,dy-8+bob,2,9); ctx.fillRect(dx-4,dy-5+bob,8,2);
            } else if (item.ammoType) {
                ctx.fillStyle=item.ammoType==='arrow'?'#FFD700':'#A1887F';
                ctx.fillRect(dx-4,dy-3+bob,8,6);
                ctx.fillStyle='#fff'; ctx.font='8px Courier New'; ctx.textAlign='center'; ctx.fillText(`x${item.ammoCount}`,dx,dy-8+bob); ctx.textAlign='left';
            }
            ctx.globalAlpha=1;
        }

        for (const chest of S.chests) {
            const dx=chest.x-camera.x, dy=chest.y-camera.y;
            if (dx<-40||dx>canvas.width+40||dy<-40||dy>canvas.height+40) continue;
            if (chest.opened) {
                ctx.fillStyle='#4e342e'; ctx.fillRect(dx-13,dy-2,26,12); ctx.strokeStyle='#3e2723'; ctx.lineWidth=1; ctx.strokeRect(dx-13,dy-2,26,12);
            } else {
                const rc=chest.loot?.color||'#9e9e9e';
                ctx.fillStyle='#795548'; ctx.fillRect(dx-13,dy-7,26,14);
                ctx.fillStyle='#5d4037'; ctx.fillRect(dx-13,dy-7,26,5);
                ctx.fillStyle=rc; ctx.fillRect(dx-3,dy-4,6,7);
                ctx.fillStyle='#4e342e'; ctx.fillRect(dx-1,dy-1,2,3);
                ctx.strokeStyle=rc; ctx.lineWidth=1; ctx.strokeRect(dx-14,dy-8,28,16);
                ctx.fillStyle=rc; ctx.font='bold 8px Courier New'; ctx.textAlign='center'; ctx.fillText('CHEST',dx,dy-12); ctx.textAlign='left';
            }
        }

        for (const t of S.archerTowers) t.draw();
        for (const n of S.npcs) n.draw();
        for (const e of S.enemies) e.draw();
        S.player.drawPlayer();
        for (const p of S.projectiles) p.draw();

        for (let i=S.particles.length-1;i>=0;i--) {
            const p=S.particles[i]; p.x+=p.vx*0.016; p.y+=p.vy*0.016; p.life-=0.016;
            if (p.life<=0){ S.particles.splice(i,1); continue; }
            ctx.fillStyle=p.color; ctx.globalAlpha=p.life*2.5; ctx.fillRect(p.x-camera.x,p.y-camera.y,p.size,p.size); ctx.globalAlpha=1;
        }

        for (let i=S.floatTexts.length-1;i>=0;i--) {
            const ft=S.floatTexts[i]; ft.y-=28*(1/60); ft.life-=(1/60);
            if (ft.life<=0){ S.floatTexts.splice(i,1); continue; }
            ctx.fillStyle=ft.color; ctx.font=ft.isCrit?'bold 26px Courier New':'bold 16px Courier New';
            ctx.globalAlpha=ft.life/ft.maxLife; const mw2=ctx.measureText(ft.text).width;
            ctx.fillText(ft.text,ft.x-camera.x-mw2/2,ft.y-camera.y); ctx.globalAlpha=1;
        }

        renderMinimap();
    }

    if (S.currentState!==GameState.MENU) S.animationFrameId=requestAnimationFrame(gameLoop);
}
