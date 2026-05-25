// ============================================================
// SYSTEMS  ─  quests + spawn manager + save/load
// ============================================================
'use strict';
import { S } from './state.js';
import { MonsterTypes, BIOME_SPAWN_TABLES, RING_ITEMS } from './world.js';
import { getBiomeAtWorld } from './biomes.js';
import { showFloatingText } from './entities.js';
import { Enemy } from './entities.js';
import { updateQuestTracker } from './ui.js';

// ── Quest definitions ────────────────────────────────────────
export const QUEST_DEFS = [
    { id:'pest_control',  title:'Pest Control',    desc:'Kill 15 Giant Rats for Bert.',   type:'kill_type',    target:'rat',      required:15, reward:{type:'maxHp',amount:25},  rewardText:'+25 Max HP' },
    { id:'explorer',      title:'Explorer',        desc:'Visit 3 towns.',                  type:'visit_towns',  required:3,        reward:{type:'xp',amount:600},     rewardText:'+600 XP' },
    { id:'treasure',      title:'Treasure Hunter', desc:'Open 5 treasure chests.',         type:'open_chests',  required:5,        reward:{type:'item',item:RING_ITEMS[1]},rewardText:'Silver Ring' },
    { id:'slayer',        title:'Monster Slayer',  desc:'Slay 50 monsters.',               type:'total_kills',  required:50,       reward:{type:'damage',amount:5},   rewardText:'+5 Damage' },
    { id:'biome_walker',  title:'Biome Walker',    desc:'Visit 4 different biomes.',       type:'visit_biomes', required:4,        reward:{type:'speed',amount:20},   rewardText:'+20 Speed' },
];

export const questSystem = {
    quests:[], visitedBiomes:new Set(), visitedTownIds:new Set(), openedChests:0,

    init() {
        this.quests = QUEST_DEFS.map(d => ({ ...d, progress:0, completed:false }));
        this.visitedBiomes.clear();
        this.visitedTownIds.clear();
        this.openedChests = 0;
    },

    tick() {
        const player = S.player;
        for (const q of this.quests) {
            if (q.completed) continue;
            if (q.type === 'total_kills')  q.progress = player.kills;
            if (q.type === 'visit_biomes') q.progress = this.visitedBiomes.size;
            if (q.type === 'visit_towns')  q.progress = this.visitedTownIds.size;
            if (q.type === 'open_chests')  q.progress = this.openedChests;
            if (q.progress >= q.required)  this.complete(q);
        }
    },

    onKill(typeId) {
        for (const q of this.quests) {
            if (q.type==='kill_type' && q.target===typeId && !q.completed) {
                q.progress = Math.min(q.progress+1, q.required);
                if (q.progress >= q.required) this.complete(q);
            }
        }
    },

    complete(q) {
        if (q.completed) return;
        q.completed = true;
        const player = S.player;
        const r = q.reward;
        if (r.type==='maxHp')   { player.maxHp+=r.amount; player.hp=Math.min(player.hp+r.amount,player.maxHp); }
        if (r.type==='xp')      player.gainXp(r.amount);
        if (r.type==='damage')  player.damage+=r.amount;
        if (r.type==='speed')   player.speed+=r.amount;
        if (r.type==='item' && r.item && !player.equipment.ring) player.equipment.ring = r.item;
        showFloatingText(player.x, player.y-80, `QUEST: ${q.title} COMPLETE!`, '#FFD700');
        updateQuestTracker();
    },

    onVisitBiome(id)  { this.visitedBiomes.add(id); },
    onVisitTown(id)   { this.visitedTownIds.add(id); },
    onOpenChest()     { this.openedChests++; },
};

// ── Spawn Manager ────────────────────────────────────────────
export const spawnManager = {
    spawnTimer:0, lastBossLevel:0, bossSpawned:false,

    update(dt) {
        const player = S.player;
        this.spawnTimer-=dt;
        const diff=document.getElementById('difficulty-select')?.value||'normal';
        const iMult=diff==='easy'?2.1:(diff==='hard'?0.75:1.0);
        const interval=Math.max(0.18,(1.2-player.level*0.035)*iMult);
        if (this.spawnTimer<=0){ this.spawnEnemy(); this.spawnTimer=interval; }
        if (player.level>this.lastBossLevel&&player.level%5===0&&!this.bossSpawned) {
            this.spawnBoss(); this.bossSpawned=true;
            showFloatingText(player.x,player.y-90,`LEVEL ${player.level}: BOSS INCOMING!`,'#ff4400');
        } else if (player.level>this.lastBossLevel&&player.level%5!==0){ this.bossSpawned=false; this.lastBossLevel=player.level; }
    },

    spawnEnemy() {
        const player = S.player;
        const { canvas } = S;
        const diff=document.getElementById('difficulty-select')?.value||'normal';
        const maxE=diff==='easy'?Math.min(14,3+Math.floor(player.level*0.8)):(diff==='hard'?Math.min(65,6+player.level*3):Math.min(45,4+player.level*2));
        if (S.enemies.length>=maxE) return;

        const biome=getBiomeAtWorld(player.x,player.y);
        const table=BIOME_SPAWN_TABLES[biome.id]||BIOME_SPAWN_TABLES['plains'];
        const available=MonsterTypes.filter(m=>!m.isBoss&&player.level>=m.minLevel&&table.includes(m.id));
        const fallback=MonsterTypes.filter(m=>!m.isBoss&&player.level>=m.minLevel);
        const pool=(available.length>0?available:fallback);
        if (!pool.length) return;

        let wPool=[];
        for (const m of pool) {
            const above=player.level-m.minLevel;
            const w=above<=2?(0.3+above*0.35):Math.max(0.05,1.0-(above-2)*0.08);
            wPool.push({type:m,weight:w});
        }
        const total=wPool.reduce((s,e)=>s+e.weight,0);
        let r=Math.random()*total; let chosen=wPool[0].type;
        for (const e of wPool){ r-=e.weight; if(r<=0){chosen=e.type;break;} }

        const a=Math.random()*Math.PI*2;
        const dist=Math.max(canvas.width,canvas.height)/2+120;
        const x=player.x+Math.cos(a)*dist, y=player.y+Math.sin(a)*dist;
        S.enemies.push(new Enemy(x,y,chosen));
    },

    spawnBoss() {
        const player = S.player;
        const a=Math.random()*Math.PI*2;
        const x=player.x+Math.cos(a)*330, y=player.y+Math.sin(a)*330;
        const bosses=MonsterTypes.filter(m=>m.isBoss);
        const btype=bosses[Math.floor(Math.random()*bosses.length)];
        const boss=new Enemy(x,y,btype);
        boss.maxHp*=(1+player.level*0.1); boss.hp=boss.maxHp;
        S.enemies.push(boss);
    }
};

// ── Save / Load ──────────────────────────────────────────────
export function saveGame() {
    const player = S.player;
    if (!player) return;
    const data = {
        player:{ level:player.level,xp:player.xp,xpToNext:player.xpToNext,score:player.score,kills:player.kills,maxHp:player.maxHp,hp:player.hp,damage:player.damage,speed:player.speed,abilityPower:player.abilityPower,arrows:player.arrows,rocks:player.rocks,equipment:player.equipment },
        classType:player.classType==='knight'?'human':player.classType,
        timestamp:new Date().toISOString()
    };
    try {
        localStorage.setItem('endlessChronicles_save',JSON.stringify(data));
        document.getElementById('save-msg').innerText='Game Saved!';
        document.getElementById('save-msg').className='mt-4 text-sm text-green-400 h-4';
        document.getElementById('load-save-btn').classList.remove('hidden');
    } catch(e) { document.getElementById('save-msg').innerText='Save Failed.'; }
}
export function checkSaveGame() { return !!localStorage.getItem('endlessChronicles_save'); }
export function deleteSaveGame() { localStorage.removeItem('endlessChronicles_save'); }
