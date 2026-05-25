// ============================================================
// ENTITY CLASSES + helpers
//   Player, NPC, Enemy, Projectile, ArcherTower
//   particles, floating text, tree collision
// ============================================================
'use strict';
import { S, TILE_SIZE, TREE_COLL_R } from './state.js';
import { getBiomeAtWorld } from './biomes.js';
import { ARMOR_ITEMS, RING_ITEMS, getBuildingWalls } from './world.js';
import { getTreesNearPoint } from './chunks.js';
import { questSystem } from './systems.js';
import { achievements } from './achievements.js';
import { updateHUD, updateQuestTracker } from './ui.js';
import { triggerLevelUpScreen, gameOver, triggerVictory } from './game.js';

// ── Player class data ────────────────────────────────────────
export const Classes = {
    human:  { name:'Human Knight',  color:'var(--accent-color)', size:24, baseHp:150, baseDmg:15, baseSpeed:185, attackCooldown:340, attackRange:42, rangedCooldown:1200, abilityName:'Block',    manaReq:0,  colorFill:'#A5D6A7', outline:'#2E7D32' },
    wizard: { name:'Arcane Wizard', color:'var(--wizard-color)', size:20, baseHp:80,  baseDmg:10, baseSpeed:162, attackCooldown:580, attackRange:32, rangedCooldown:2600, abilityName:'Fireball', manaReq:30, baseMana:100, manaRegen:6, colorFill:'#CE93D8', outline:'#6A1B9A' },
    beast:  { name:'Feral Beast',   color:'var(--beast-color)',  size:26, baseHp:120, baseDmg:20, baseSpeed:225, attackCooldown:195, attackRange:32, rangedCooldown:2000, abilityName:'Lifesteal',manaReq:0,  colorFill:'#FFCC80', outline:'#E65100' },
};

// ── Helpers ──────────────────────────────────────────────────
export function createParticles(x,y,color,count) {
    for(let i=0;i<count;i++) {
        S.particles.push({ x,y,vx:(Math.random()-0.5)*180,vy:(Math.random()-0.5)*180,size:Math.random()*4+2,color,life:0.4+Math.random()*0.3 });
    }
}
export function showFloatingText(x,y,text,color='white',isCrit=false) {
    S.floatTexts.push({ x,y,text:String(text),color,isCrit,life:1.2,maxLife:1.2 });
}

// ── Wilderness landmark types ────────────────────────────────
// Shrines, abandoned camps, wild NPCs are simple drawable objects with an
// optional interact() method invoked by F-press.
export const WILD_NPC_PRESETS = [
    { tag:'hermit',    name:'Mad Hermit Crustleworth', dialogue:[
        '"You ever try... eating a rock? I have. Six. They were terrible."',
        '"Out here you learn things. Mostly that you should have stayed home."',
        '"The Hydra in the bog? Yeah. Don\'t. Just don\'t."',
    ]},
    { tag:'wanderer',  name:'The Lost Cartographer',   dialogue:[
        '"I had a map. I lost the map. Now I am the map. Conceptually."',
        '"Towns are that way. Or possibly that way. Definitely a way."',
        '"If you see Bumblesnatch, please tell them Gertrude is fine."',
    ]},
    { tag:'sage',      name:'Sage Pibblewhisker',      dialogue:[
        '"Wisdom: shields good. Fire bad. That\'ll be 12 gold."',
        '"Snorflaxia? Pft. I knew her great-aunt. Lovely woman. Mildly cursed."',
        '"You will face great peril. Also, possibly some moderate peril."',
    ]},
    { tag:'merc',      name:'Sellsword Brom',          isMerchant:true, dialogue:[
        '"Out here? Out HERE I sell at a HUGE markup. It\'s the inconvenience tax."',
        '"You buying? You should be buying."',
    ]},
];

export class Shrine {
    constructor(wx, wy, biomeId, key) {
        this.x = wx; this.y = wy; this.size = 22;
        this.biomeId = biomeId; this.key = key;
        this.used = false;
        // Buff varies by biome
        const buffs = {
            forest:   { stat:'speed',  amount:15, label:'Agility', color:'#69F0AE' },
            desert:   { stat:'damage', amount:4,  label:'Strength', color:'#FFB300' },
            bog:      { stat:'maxHp',  amount:30, label:'Vitality', color:'#43A047' },
            tundra:   { stat:'maxHp',  amount:25, label:'Endurance', color:'#80DEEA' },
            ruins:    { stat:'damage', amount:6,  label:'Ancient Might', color:'#B388FF' },
            volcanic: { stat:'damage', amount:8,  label:'Fury', color:'#FF5722' },
            void:     { stat:'maxHp',  amount:60, label:'Soulshield', color:'#E040FB' },
        };
        this.buff = buffs[biomeId] || buffs.forest;
    }
    draw() {
        const { ctx, camera, canvas, player } = S;
        const dx = this.x-camera.x, dy = this.y-camera.y;
        if (dx<-40||dx>canvas.width+40||dy<-40||dy>canvas.height+40) return;
        // Stone obelisk + glow
        ctx.fillStyle='rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(dx, dy+14, 14, 5, 0, 0, Math.PI*2); ctx.fill();
        if (!this.used) {
            const pulse = 0.45 + Math.sin(Date.now()/240)*0.25;
            ctx.save(); ctx.globalAlpha = pulse * 0.45;
            ctx.fillStyle = this.buff.color;
            ctx.beginPath(); ctx.arc(dx, dy-4, 28, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
        ctx.fillStyle = this.used ? '#3a3a44' : '#5a5a70';
        ctx.fillRect(dx-7, dy-16, 14, 28);
        ctx.fillStyle = this.used ? '#2a2a34' : '#42424f';
        ctx.fillRect(dx-9, dy+10, 18, 6);
        // Glyph
        ctx.fillStyle = this.used ? '#666' : this.buff.color;
        ctx.font = 'bold 14px Courier New'; ctx.textAlign='center';
        ctx.fillText('✦', dx, dy-2);
        ctx.textAlign='left';
        if (player && Math.hypot(player.x-this.x, player.y-this.y) < 60) {
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.font = 'bold 10px Courier New'; ctx.textAlign = 'center';
            if (this.used) ctx.fillText('Shrine (used)', dx, dy-30);
            else ctx.fillText(`[F] Pray (+${this.buff.amount} ${this.buff.label})`, dx, dy-30);
            ctx.textAlign = 'left';
        }
    }
    interact() {
        if (this.used) return;
        const player = S.player;
        const b = this.buff;
        if (b.stat==='maxHp')  { player.maxHp += b.amount; player.hp = Math.min(player.maxHp, player.hp+b.amount); }
        if (b.stat==='damage') { player.damage += b.amount; }
        if (b.stat==='speed')  { player.speed += b.amount; }
        this.used = true;
        showFloatingText(this.x, this.y-40, `+${b.amount} ${b.label}!`, b.color);
        showFloatingText(this.x, this.y-60, 'The shrine fades.', '#aaa');
        updateHUD();
    }
}

export class Camp {
    constructor(wx, wy, key) {
        this.x = wx; this.y = wy; this.size = 36;
        this.key = key;
        this.fireAngle = Math.random()*Math.PI*2;
    }
    draw() {
        const { ctx, camera, canvas } = S;
        const dx = this.x-camera.x, dy = this.y-camera.y;
        if (dx<-50||dx>canvas.width+50||dy<-50||dy>canvas.height+50) return;
        // Ground scorch
        ctx.fillStyle='rgba(0,0,0,0.40)';
        ctx.beginPath(); ctx.ellipse(dx, dy+4, 26, 9, 0, 0, Math.PI*2); ctx.fill();
        // Logs (cross)
        ctx.fillStyle='#5d3a1a';
        ctx.fillRect(dx-12, dy-2, 24, 4);
        ctx.save(); ctx.translate(dx, dy); ctx.rotate(Math.PI/4);
        ctx.fillRect(-12, -2, 24, 4);
        ctx.restore();
        // Flickering fire
        const fl = 0.65 + Math.sin(Date.now()/90 + this.fireAngle)*0.25;
        ctx.fillStyle = `rgba(255, ${Math.floor(120+fl*100)}, 0, 0.85)`;
        ctx.beginPath();
        ctx.moveTo(dx, dy-14); ctx.lineTo(dx-7, dy); ctx.lineTo(dx+7, dy);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 220, 80, ${0.5+fl*0.35})`;
        ctx.beginPath();
        ctx.moveTo(dx, dy-9); ctx.lineTo(dx-4, dy-1); ctx.lineTo(dx+4, dy-1);
        ctx.fill();
        // Tent (off to one side)
        ctx.fillStyle='#5e4633';
        ctx.beginPath();
        ctx.moveTo(dx+18, dy+8); ctx.lineTo(dx+38, dy+8); ctx.lineTo(dx+28, dy-12);
        ctx.fill();
        ctx.fillStyle='#3c2a18';
        ctx.beginPath();
        ctx.moveTo(dx+24, dy+8); ctx.lineTo(dx+32, dy+8); ctx.lineTo(dx+28, dy+0);
        ctx.fill();
    }
}

export class WildNPC {
    constructor(wx, wy, preset, key) {
        this.x = wx; this.y = wy; this.size = 16;
        this.homeX = wx; this.homeY = wy;
        this.name = preset.name;
        this.dialogue = preset.dialogue;
        this.isMerchant = !!preset.isMerchant;
        this.key = key; this.preset = preset.tag;
        this.dialogueIndex = 0;
        this.wanderTimer = Math.random()*4 + 2;
        this.vx = 0; this.vy = 0;
    }
    update(dt) {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
            const ang = Math.random()*Math.PI*2, dist = Math.random()*50;
            const tx = this.homeX + Math.cos(ang)*dist, ty = this.homeY + Math.sin(ang)*dist;
            const dxn = tx - this.x, dyn = ty - this.y, d = Math.hypot(dxn,dyn) || 1;
            this.vx = (dxn/d)*16; this.vy = (dyn/d)*16;
            this.wanderTimer = 3 + Math.random()*3;
        }
        this.x += this.vx*dt; this.y += this.vy*dt;
    }
    draw() {
        const { ctx, camera, canvas, player } = S;
        const dx = this.x-camera.x, dy = this.y-camera.y;
        if (dx<-40||dx>canvas.width+40||dy<-40||dy>canvas.height+40) return;
        ctx.fillStyle='rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(dx, dy+12, 10, 4, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle='#5a3a20'; ctx.fillRect(dx-5, dy+6, 4, 7); ctx.fillRect(dx+1, dy+6, 4, 7);
        const robe = this.preset==='hermit' ? '#5a4030' :
                     this.preset==='wanderer' ? '#4a5560' :
                     this.preset==='sage' ? '#3a2855' : '#7a4020';
        ctx.fillStyle = robe; ctx.fillRect(dx-7, dy-4, 14, 10);
        ctx.fillStyle = '#FFE0B2'; ctx.beginPath(); ctx.arc(dx, dy-9, 7, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#333'; ctx.fillRect(dx-3, dy-10, 2, 2); ctx.fillRect(dx+1, dy-10, 2, 2);
        // Hood / hat
        if (this.preset==='sage') { ctx.fillStyle='#1a0a3a'; ctx.fillRect(dx-7, dy-18, 14, 6); ctx.beginPath(); ctx.moveTo(dx-7,dy-18); ctx.lineTo(dx,dy-28); ctx.lineTo(dx+7,dy-18); ctx.fill(); }
        else if (this.preset==='hermit') { ctx.fillStyle='#3a2210'; ctx.fillRect(dx-8, dy-17, 16, 7); }
        else { ctx.fillStyle='#3a2818'; ctx.fillRect(dx-6, dy-15, 12, 5); }

        ctx.font='8px Courier New';
        const nw = ctx.measureText(this.name).width;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(dx-nw/2-2, dy-28, nw+4, 11);
        ctx.fillStyle = this.isMerchant ? '#FFA000' : '#CE93D8';
        ctx.textAlign='center'; ctx.fillText(this.name, dx, dy-19); ctx.textAlign='left';
        if (player && Math.hypot(player.x-this.x, player.y-this.y) < 60) {
            ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font='bold 10px Courier New'; ctx.textAlign='center';
            ctx.fillText('[F] Talk', dx, dy-38);
            ctx.textAlign='left';
        }
    }
}

export function resolveTreeCollision(entity) {
    const trees = getTreesNearPoint(entity.x, entity.y, TREE_COLL_R+entity.size/2+12);
    for (const tree of trees) {
        const dist=Math.hypot(entity.x-tree.x,entity.y-tree.y);
        const minD=TREE_COLL_R+entity.size/2+3;
        if (dist<minD&&dist>0){ const push=(minD-dist)+1; entity.x+=(entity.x-tree.x)/dist*push; entity.y+=(entity.y-tree.y)/dist*push; }
    }
}

// Push entity out of any town-building wall AABB it overlaps.
// Buildings have a door gap at the bottom-center — entities approach the
// door naturally because walls form an open mouth there.
export function resolveBuildingWallCollision(entity) {
    const r = entity.size / 2;
    for (const wall of getBuildingWalls()) {
        const overL = (entity.x + r) - wall.x;
        const overR = (wall.x + wall.w) - (entity.x - r);
        const overT = (entity.y + r) - wall.y;
        const overB = (wall.y + wall.h) - (entity.y - r);
        if (overL > 0 && overR > 0 && overT > 0 && overB > 0) {
            const mH = Math.min(overL, overR);
            const mV = Math.min(overT, overB);
            if (mH < mV) {
                if (overL < overR) entity.x -= overL + 0.5;
                else               entity.x += overR + 0.5;
            } else {
                if (overT < overB) entity.y -= overT + 0.5;
                else               entity.y += overB + 0.5;
            }
        }
    }
}

// ── Entity base ──────────────────────────────────────────────
export class Entity {
    constructor(x,y,size,color){ this.x=x; this.y=y; this.size=size; this.color=color; this.vx=0; this.vy=0; }
    draw() { S.ctx.fillStyle=this.color; S.ctx.fillRect(this.x-this.size/2-S.camera.x, this.y-this.size/2-S.camera.y, this.size, this.size); }
}

// ── Player ───────────────────────────────────────────────────
export class Player extends Entity {
    constructor(classData) {
        super(0,0,classData.size,classData.colorFill);
        this.classType = classData.name.split(' ')[1].toLowerCase();
        this.outlineColor = classData.outline;
        this.level=1; this.xp=0; this.xpToNext=50; this.score=0; this.kills=0;
        this.maxHp=classData.baseHp; this.hp=this.maxHp;
        this.damage=classData.baseDmg; this.speed=classData.baseSpeed;
        this.maxMana=classData.baseMana||0; this.mana=this.maxMana; this.manaRegen=classData.manaRegen||0;
        this.attackCooldown=classData.attackCooldown; this.lastAttackTime=0; this.attackRange=classData.attackRange;
        this.rangedCooldown=classData.rangedCooldown; this.lastRangedTime=0;
        this.arrows=this.classType==='knight'?12:0; this.rocks=this.classType==='beast'?10:0;
        this.abilityPower=1; this.isBlocking=false;
        this.equipment={armor:null,ring:null,shield:null};
        this.shielding=false; this.shieldTimer=0; this.shieldCooldownTimer=0;
        this.facing='right'; this.facingAngle=0; this.isSwinging=false;
        this._slowed=false; this._slowTimer=0; this._origSpeed=null;
    }

    update(dt) {
        const { keys, canvas, camera } = S;
        if (this._slowed) {
            this._slowTimer-=dt;
            if (this._slowTimer<=0) {
                this._slowed=false;
                if (this._origSpeed) { this.speed=this._origSpeed; this._origSpeed=null; }
            }
        }
        this.vx=0; this.vy=0;
        if (this.isBlocking) return;
        if (keys.w||keys.ArrowUp)    this.vy-=1;
        if (keys.s||keys.ArrowDown)  this.vy+=1;
        if (keys.a||keys.ArrowLeft)  this.vx-=1;
        if (keys.d||keys.ArrowRight) this.vx+=1;
        if (this.vx!==0&&this.vy!==0){ const l=Math.SQRT2; this.vx/=l; this.vy/=l; }
        if (this.vx!==0||this.vy!==0){ this.facingAngle=Math.atan2(this.vy,this.vx); this.facing=this.vx>=0?'right':'left'; }
        this.x+=this.vx*this.speed*dt;
        this.y+=this.vy*this.speed*dt;
        resolveTreeCollision(this);
        resolveBuildingWallCollision(this);
        if (this.maxMana>0&&this.mana<this.maxMana){ this.mana+=this.manaRegen*dt; if(this.mana>this.maxMana)this.mana=this.maxMana; }
        camera.x=this.x-canvas.width/2;
        camera.y=this.y-canvas.height/2;
        if (this.shielding){ this.shieldTimer-=dt; if(this.shieldTimer<=0){ this.shielding=false; this.shieldTimer=0; this.shieldCooldownTimer=this.equipment.shield?this.equipment.shield.cooldown:0; showFloatingText(this.x,this.y-20,'Shield down!','#78909C'); }}
        else if (this.shieldCooldownTimer>0){ this.shieldCooldownTimer=Math.max(0,this.shieldCooldownTimer-dt); }
    }

    attack() {
        const now=performance.now();
        if (now-this.lastAttackTime<this.attackCooldown) return;
        if (this.classType==='knight') {
            this.isBlocking=true; this.color='#81C784';
            setTimeout(()=>{ this.isBlocking=false; this.color=Classes.human.colorFill; this.swingWeapon(); },200);
        } else { this.swingWeapon(); }
        this.lastAttackTime=now;
    }

    rangedAttack() {
        const now=performance.now();
        if (now-this.lastRangedTime<this.rangedCooldown) return;
        if (this.classType==='knight') {
            if (this.arrows<=0){ showFloatingText(this.x,this.y-20,'No Arrows!','#FFD700'); return; }
            this.arrows--; this.fireProjectile('arrow',this.damage*1.5); this.lastRangedTime=now; updateHUD();
        } else if (this.classType==='wizard') {
            if (this.mana<30){ showFloatingText(this.x,this.y-20,'No Mana!','#2196F3'); return; }
            this.mana-=30; this.fireProjectile('fireball',this.damage*this.abilityPower*2.5); this.lastRangedTime=now; updateHUD();
        } else {
            if (this.rocks<=0){ showFloatingText(this.x,this.y-20,'No Rocks!','#A1887F'); return; }
            this.rocks--; this.fireProjectile('rock',this.damage*2.0); this.lastRangedTime=now; updateHUD();
        }
    }

    fireProjectile(type,damage) {
        if (this.equipment.ring) damage=Math.floor(damage*this.equipment.ring.damageMult);
        S.projectiles.push(new Projectile(this.x,this.y,this.facingAngle,true,damage,type));
    }

    activateShield() {
        if (!this.equipment.shield){ showFloatingText(this.x,this.y-20,'No shield!','#aaa'); return; }
        if (this.shielding) return;
        if (this.shieldCooldownTimer>0){ showFloatingText(this.x,this.y-20,`Shield: ${Math.ceil(this.shieldCooldownTimer)}s`,'#78909C'); return; }
        this.shielding=true; this.shieldTimer=this.equipment.shield.blockDuration;
        showFloatingText(this.x,this.y-20,'SHIELD!','#29b6f6');
    }

    swingWeapon() {
        this.isSwinging=true;
        S.enemies.forEach(enemy=>{
            const dist=Math.hypot(enemy.x-this.x,enemy.y-this.y);
            const aTE=Math.atan2(enemy.y-this.y,enemy.x-this.x);
            const aDiff=Math.atan2(Math.sin(aTE-this.facingAngle),Math.cos(aTE-this.facingAngle));
            if (dist<=this.attackRange+enemy.size+12&&Math.abs(aDiff)<Math.PI*0.61) {
                let dmg=this.classType==='wizard'?Math.floor(this.damage*0.6):this.damage;
                if (this.equipment.ring) dmg=Math.floor(dmg*this.equipment.ring.damageMult);
                let isCrit=false;
                if (this.classType==='beast'&&Math.random()<0.20){ dmg*=2; isCrit=true; this.heal(Math.floor(dmg*0.2*this.abilityPower)); }
                enemy.takeDamage(dmg,isCrit);
                const ang=Math.atan2(enemy.y-this.y,enemy.x-this.x);
                enemy.x+=Math.cos(ang)*22; enemy.y+=Math.sin(ang)*22;
            }
        });
        S.archerTowers.forEach(tower=>{
            const dist=Math.hypot(tower.x-this.x,tower.y-this.y);
            const aTE=Math.atan2(tower.y-this.y,tower.x-this.x);
            const aDiff=Math.atan2(Math.sin(aTE-this.facingAngle),Math.cos(aTE-this.facingAngle));
            if (dist<=this.attackRange+tower.tw/2+12&&Math.abs(aDiff)<Math.PI*0.61){
                let dmg=this.classType==='wizard'?Math.floor(this.damage*0.6):this.damage;
                if (this.equipment.ring) dmg=Math.floor(dmg*this.equipment.ring.damageMult);
                let isCrit=false;
                if (this.classType==='beast'&&Math.random()<0.2){dmg*=2;isCrit=true;}
                tower.takeDamage(dmg,isCrit);
            }
        });
        setTimeout(()=>{ this.isSwinging=false; },150);
    }

    takeDamage(amount,killerName=null) {
        if (this.shielding) {
            if (this.equipment.shield?.reflects) { S.enemies.forEach(e=>{ if(Math.hypot(e.x-this.x,e.y-this.y)<130)e.takeDamage(amount); }); showFloatingText(this.x,this.y-30,'REFLECTED!','#29b6f6'); }
            else { showFloatingText(this.x,this.y-20,'BLOCKED!','#29b6f6'); }
            return;
        }
        if (this.equipment.armor) amount=Math.ceil(amount*(1-this.equipment.armor.damageReduction));
        if (this.isBlocking) { amount=Math.floor(amount*(0.3/this.abilityPower)); showFloatingText(this.x,this.y-20,'Block!','#81C784'); }
        this.hp-=amount; updateHUD();
        const orig=this.color; this.color='#fff'; setTimeout(()=>this.color=orig,100);
        if (this.hp<=0) gameOver(killerName);
    }

    heal(amount) { this.hp=Math.min(this.maxHp,this.hp+amount); showFloatingText(this.x,this.y-30,`+${Math.floor(amount)}`,'#4CAF50'); updateHUD(); }

    gainXp(amount) {
        this.xp+=amount; this.score+=amount;
        if (this.xp>=this.xpToNext) this.levelUp();
        updateHUD();
    }

    levelUp() {
        this.level++; this.xp-=this.xpToNext;
        this.xpToNext=Math.floor(this.xpToNext*1.75);
        this.maxHp+=10; this.hp=this.maxHp; this.damage+=2;
        achievements.recordLevelUp(this.level);
        triggerLevelUpScreen();
    }

    drawPlayer() {
        const { ctx, camera } = S;
        const drawX=this.x-camera.x, drawY=this.y-camera.y;
        const bob=(this.vx!==0||this.vy!==0)?Math.sin(performance.now()/100)*2:0;
        ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(drawX,drawY+this.size/2,this.size/1.5,this.size/4,0,0,Math.PI*2); ctx.fill();
        if (this.shielding) {
            const pulse=0.35+Math.sin(Date.now()/90)*0.12;
            ctx.save(); ctx.globalAlpha=pulse*0.4; ctx.fillStyle='#29b6f6';
            ctx.beginPath(); ctx.arc(drawX,drawY,this.size*1.35,0,Math.PI*2); ctx.fill();
            ctx.globalAlpha=pulse; ctx.strokeStyle='#29b6f6'; ctx.lineWidth=2.5;
            ctx.beginPath(); ctx.arc(drawX,drawY,this.size*1.35,0,Math.PI*2); ctx.stroke(); ctx.restore();
        }
        const bA=this.facingAngle+Math.PI/2;
        const eOff=Math.cos(this.facingAngle)>=0?2:-2;

        if (this.classType==='knight') {
            ctx.fillStyle='#546E7A'; ctx.fillRect(drawX-8,drawY+8+bob,6,8); ctx.fillRect(drawX+2,drawY+8+bob,6,8);
            ctx.fillStyle='#78909C'; ctx.fillRect(drawX-10,drawY-4+bob,20,14);
            ctx.fillStyle='#90A4AE'; ctx.fillRect(drawX-10,drawY-4+bob,20,5);
            ctx.fillStyle='#607D8B'; ctx.fillRect(drawX-14,drawY-6+bob,6,7); ctx.fillRect(drawX+8,drawY-6+bob,6,7);
            ctx.fillStyle='#607D8B'; ctx.fillRect(drawX-9,drawY-18+bob,18,16);
            ctx.fillStyle='#546E7A'; ctx.fillRect(drawX-4,drawY-22+bob,8,5);
            ctx.fillStyle='#37474F'; ctx.fillRect(drawX-9,drawY-10+bob,18,5);
            ctx.fillStyle='#E3F2FD'; ctx.fillRect(drawX+eOff-7,drawY-9+bob,5,2); ctx.fillRect(drawX+eOff+2,drawY-9+bob,5,2);
            ctx.fillStyle='#455A64'; ctx.fillRect(drawX-2,drawY-18+bob,4,13);
            ctx.save(); ctx.translate(drawX,drawY+bob);
            const wRot=this.isSwinging?bA+(-Math.PI/3+Math.min(1,(performance.now()-this.lastAttackTime)/150)*Math.PI*2/3):bA-Math.PI/6;
            ctx.rotate(wRot);
            ctx.fillStyle='#CFD8DC'; ctx.fillRect(-2,-this.size-6,4,this.size+6);
            ctx.fillStyle='#9E9E9E'; ctx.fillRect(-6,-this.size,12,3);
            ctx.fillStyle='#795548'; ctx.fillRect(-2,-this.size+3,4,8);
            if (this.isBlocking){ ctx.fillStyle='#1565C0'; ctx.beginPath(); ctx.arc(12,0,10,-Math.PI/2,Math.PI/2); ctx.fill(); ctx.fillStyle='#FFD700'; ctx.fillRect(10,-6,2,12); }
            ctx.restore();
        } else if (this.classType==='wizard') {
            ctx.fillStyle='#7B1FA2'; ctx.beginPath(); ctx.moveTo(drawX-8,drawY-2+bob); ctx.lineTo(drawX-13,drawY+14+bob); ctx.lineTo(drawX+13,drawY+14+bob); ctx.lineTo(drawX+8,drawY-2+bob); ctx.closePath(); ctx.fill();
            ctx.strokeStyle='#4A148C'; ctx.lineWidth=1; ctx.stroke();
            ctx.fillStyle='#FFD700'; ctx.fillRect(drawX-5,drawY+2+bob,3,3); ctx.fillRect(drawX+3,drawY+7+bob,3,3);
            ctx.fillStyle='#FFE0B2'; ctx.beginPath(); ctx.arc(drawX,drawY-8+bob,8,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle='#BCAAA4'; ctx.lineWidth=1; ctx.stroke();
            ctx.fillStyle='#1A237E'; ctx.fillRect(drawX+eOff-5,drawY-9+bob,3,3); ctx.fillRect(drawX+eOff+2,drawY-9+bob,3,3);
            ctx.fillStyle='#E0E0E0'; ctx.fillRect(drawX-4,drawY-3+bob,8,3);
            ctx.fillStyle='#6A1B9A'; ctx.fillRect(drawX-9,drawY-16+bob,18,4);
            ctx.beginPath(); ctx.moveTo(drawX-7,drawY-16+bob); ctx.lineTo(drawX,drawY-28+bob); ctx.lineTo(drawX+7,drawY-16+bob); ctx.closePath(); ctx.fill();
            ctx.fillStyle='#FFD700'; ctx.fillRect(drawX-9,drawY-19+bob,18,3); ctx.fillRect(drawX-2,drawY-25+bob,4,2);
            ctx.save(); ctx.translate(drawX,drawY+bob);
            const sRot=this.isSwinging?bA+(-Math.PI/3+Math.min(1,(performance.now()-this.lastAttackTime)/150)*Math.PI*2/3):bA-Math.PI/8;
            ctx.rotate(sRot);
            ctx.fillStyle='#795548'; ctx.fillRect(-1.5,-this.size-6,3,this.size+6);
            ctx.fillStyle=this.isSwinging?'#E0F7FA':'#00BCD4'; ctx.beginPath(); ctx.arc(0,-this.size-7,this.isSwinging?7:4,0,Math.PI*2); ctx.fill();
            if (this.isSwinging){ ctx.strokeStyle='rgba(0,229,255,0.9)'; ctx.lineWidth=3; ctx.stroke(); }
            ctx.restore();
        } else {
            ctx.fillStyle='#FFCC80'; ctx.strokeStyle='#E65100'; ctx.lineWidth=2;
            ctx.fillRect(drawX-11,drawY-2+bob,22,16); ctx.strokeRect(drawX-11,drawY-2+bob,22,16);
            ctx.fillStyle='#FF8F00'; ctx.fillRect(drawX-6,drawY+bob,3,12); ctx.fillRect(drawX+3,drawY+bob,3,12);
            ctx.fillStyle='#EF6C00'; ctx.fillRect(drawX-9,drawY+12+bob,7,6); ctx.fillRect(drawX+2,drawY+12+bob,7,6);
            ctx.fillStyle='#FFCC80'; ctx.strokeStyle='#E65100'; ctx.lineWidth=2;
            ctx.fillRect(drawX-12,drawY-18+bob,24,18); ctx.strokeRect(drawX-12,drawY-18+bob,24,18);
            ctx.fillStyle='#EF6C00';
            ctx.beginPath(); ctx.moveTo(drawX-12,drawY-18+bob); ctx.lineTo(drawX-17,drawY-27+bob); ctx.lineTo(drawX-4,drawY-18+bob); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(drawX+4,drawY-18+bob); ctx.lineTo(drawX+17,drawY-27+bob); ctx.lineTo(drawX+12,drawY-18+bob); ctx.closePath(); ctx.fill();
            ctx.fillStyle='#FFAB40'; ctx.fillRect(drawX-7,drawY-9+bob,14,7);
            ctx.fillStyle='#4E342E'; ctx.fillRect(drawX-3,drawY-9+bob,6,4);
            ctx.fillStyle='#FF6F00'; ctx.fillRect(drawX+eOff-10,drawY-16+bob,7,5); ctx.fillRect(drawX+eOff+3,drawY-16+bob,7,5);
            ctx.fillStyle='#212121'; ctx.fillRect(drawX+eOff-7,drawY-15+bob,2,4); ctx.fillRect(drawX+eOff+6,drawY-15+bob,2,4);
            ctx.save(); ctx.translate(drawX,drawY+bob);
            const cRot=this.isSwinging?bA+(-Math.PI/3+Math.min(1,(performance.now()-this.lastAttackTime)/150)*Math.PI*2/3):bA-Math.PI/6;
            ctx.rotate(cRot);
            ctx.fillStyle='#FFF8E1'; ctx.beginPath(); ctx.moveTo(-3,-8); ctx.lineTo(8,-20); ctx.lineTo(13,-14); ctx.fill();
            ctx.beginPath(); ctx.moveTo(2,-10); ctx.lineTo(14,-18); ctx.lineTo(17,-12); ctx.fill();
            ctx.restore();
        }
    }
}

// ── NPC ──────────────────────────────────────────────────────
export class NPC {
    constructor(worldX, worldY, data) {
        this.x=worldX; this.y=worldY; this.homeX=worldX; this.homeY=worldY;
        this.name=data.name; this.dialogue=data.dialogue; this.isMerchant=data.isMerchant||false;
        this.dialogueIndex=0; this.size=16; this.vx=0; this.vy=0; this.wanderTimer=Math.random()*4+2;
        this.facing='down';
    }
    update(dt) {
        this.wanderTimer-=dt;
        if (this.wanderTimer<=0) {
            const ang=Math.random()*Math.PI*2, dist=Math.random()*70;
            const tx=this.homeX+Math.cos(ang)*dist, ty=this.homeY+Math.sin(ang)*dist;
            const dx=tx-this.x, dy=ty-this.y, d=Math.hypot(dx,dy)||1;
            this.vx=(dx/d)*22; this.vy=(dy/d)*22; this.wanderTimer=2+Math.random()*3;
        }
        this.x+=this.vx*dt; this.y+=this.vy*dt;
        const hd=Math.hypot(this.x-this.homeX,this.y-this.homeY);
        if (hd>90){ this.x=this.homeX+(this.x-this.homeX)*0.85; this.y=this.homeY+(this.y-this.homeY)*0.85; }
        if (Math.abs(this.vx)<1&&Math.abs(this.vy)<1){ this.vx*=0.9; this.vy*=0.9; }
    }
    draw() {
        const { ctx, camera, canvas, player } = S;
        const dx=this.x-camera.x, dy=this.y-camera.y;
        if (dx<-40||dx>canvas.width+40||dy<-40||dy>canvas.height+40) return;
        ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(dx,dy+12,10,4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#37474F'; ctx.fillRect(dx-5,dy+6,4,7); ctx.fillRect(dx+1,dy+6,4,7);
        ctx.fillStyle=this.isMerchant?'#d4850a':'#1565C0'; ctx.fillRect(dx-7,dy-4,14,10);
        ctx.fillStyle=this.isMerchant?'#8a5200':'#0d3a6e'; ctx.fillRect(dx-7,dy+4,14,2);
        ctx.fillStyle='#FFE0B2'; ctx.beginPath(); ctx.arc(dx,dy-9,7,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#333'; ctx.fillRect(dx-3,dy-10,2,2); ctx.fillRect(dx+1,dy-10,2,2);
        if (this.isMerchant) { ctx.fillStyle='#795548'; ctx.fillRect(dx-8,dy-16,16,5); ctx.fillRect(dx-5,dy-22,10,8); }
        else { ctx.fillStyle='#4e342e'; ctx.fillRect(dx-6,dy-15,12,5); }

        // Quest-ready exclamation mark (pulsing gold "!")
        const readyQuest = questSystem.readyQuestForNPC(this.name);
        if (readyQuest) {
            const pulse = 0.7 + Math.sin(Date.now()/180)*0.3;
            ctx.save(); ctx.globalAlpha = pulse;
            ctx.fillStyle='#FFD700'; ctx.font='bold 20px Courier New'; ctx.textAlign='center';
            ctx.fillText('!', dx, dy-32);
            ctx.textAlign='left'; ctx.restore();
        }

        ctx.font='8px Courier New';
        const nw=ctx.measureText(this.name).width;
        ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(dx-nw/2-2,dy-28,nw+4,11);
        ctx.fillStyle=this.isMerchant?'#FFA000':'#90CAF9'; ctx.textAlign='center'; ctx.fillText(this.name,dx,dy-19); ctx.textAlign='left';
        if (player && Math.hypot(player.x-this.x,player.y-this.y)<70) {
            ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='bold 10px Courier New'; ctx.textAlign='center';
            ctx.fillText(readyQuest ? '[F] Turn in!' : '[F] Talk', dx, dy-42);
            ctx.textAlign='left';
        }
    }
}

// ── Enemy ────────────────────────────────────────────────────
export class Enemy extends Entity {
    constructor(x,y,type) {
        super(x,y,type.size,type.color);
        const player = S.player;
        this.typeId=type.id; this.name=type.name;
        // Per-level HP/dmg scaling: linear early, slightly steeper past lv15
        // to keep individual mobs threatening when overall spawn count is low.
        const mult=1
            + Math.max(0, player.level-2) * 0.10
            + Math.max(0, player.level-15) * 0.04;
        const diffMult = (() => { const d=document.getElementById('difficulty-select')?.value||'normal'; return d==='easy'?0.75:d==='hard'?1.3:1.0; })();
        this.maxHp=Math.floor(type.hp*mult); this.hp=this.maxHp;
        this.damage=Math.floor(type.dmg*mult*diffMult);
        const earlyMult=Math.min(1.0,0.42+player.level*0.11);
        const diffSpeedMult = (() => { const d=document.getElementById('difficulty-select')?.value||'normal'; return d==='easy'?0.85:d==='hard'?1.15:1.0; })();
        this.speed=type.speed*(0.8+Math.random()*0.4)*earlyMult*diffSpeedMult;
        this.baseSpeed=this.speed; this.xpValue=Math.floor(type.xp*mult); this.behavior=type.behavior;
        this.range=type.range||0; this.isBoss=type.isBoss||false;
        this.lastAttackTime=0;
        // Enemies are aggro by default — they're spawned just outside the camera
        // intentionally to engage the player. No "wander forever" gap.
        this.aggroed=true;
        this.aggroRange=Infinity;
        this.attackState='approach'; this.attackStateTimer=0.4+Math.random()*0.8;
        this.strikeHit=false; this.meleeRange=this.size/2+26; this.stunTimer=0;
        this.knockbackVx=0; this.knockbackVy=0; this.angleOffset=Math.random()*Math.PI*2;
        this._chargeState='idle'; this._chargeTimer=5+Math.random()*4; this._chargeTarget=null;
        this._burrowState='surface'; this._burrowTimer=6+Math.random()*5;
        this.alpha=1;
    }

    update(dt) {
        if (this.alpha===0) return;
        const player = S.player;

        for (const other of S.enemies) {
            if (other===this) continue;
            const sx=this.x-other.x, sy=this.y-other.y, sd=Math.hypot(sx,sy);
            const minSep=(this.size+other.size)*0.9;
            if (sd<minSep&&sd>0){ const push=(minSep-sd)*0.5; this.x+=(sx/sd)*push; this.y+=(sy/sd)*push; }
        }
        if (player.shielding) {
            const sr=player.size*1.4+this.size*0.6;
            const pdx=this.x-player.x,pdy=this.y-player.y,pd=Math.hypot(pdx,pdy);
            if (pd<sr&&pd>0){ const push=(sr-pd)*1.1; this.x+=(pdx/pd)*push; this.y+=(pdy/pd)*push; }
            else if (pd===0){ this.x+=(Math.random()-0.5)*sr*2; this.y+=(Math.random()-0.5)*sr*2; }
        }

        const distP=Math.hypot(player.x-this.x,player.y-this.y);
        const angP=Math.atan2(player.y-this.y,player.x-this.x);

        if (this.knockbackVx!==0||this.knockbackVy!==0) {
            this.x+=this.knockbackVx*dt; this.y+=this.knockbackVy*dt;
            const decay=Math.exp(-9*dt); this.knockbackVx*=decay; this.knockbackVy*=decay;
            if (Math.abs(this.knockbackVx)<1&&Math.abs(this.knockbackVy)<1){ this.knockbackVx=0; this.knockbackVy=0; }
        }

        this._specialUpdate(dt, distP, angP);

        if (this.behavior==='ranged') {
            this.speed=this.baseSpeed;
            let moveAng=angP;
            if (distP<this.range*0.65) moveAng=angP+Math.PI;
            else if (distP<=this.range) {
                this.speed=0;
                if (performance.now()-this.lastAttackTime>2000) {
                    S.projectiles.push(new Projectile(this.x,this.y,angP,false,this.damage,'fireball',this.name));
                    this.lastAttackTime=performance.now();
                }
                return;
            }
            this.x+=Math.cos(moveAng)*this.speed*dt; this.y+=Math.sin(moveAng)*this.speed*dt;
            return;
        }

        if (this.behavior==='burrow') return;

        if (this.stunTimer>0){ this.stunTimer-=dt; return; }

        this.attackStateTimer-=dt;
        switch(this.attackState) {
            case 'approach': {
                if (!this.aggroed&&distP>this.aggroRange){ this.angleOffset+=dt*0.9; this.x+=Math.cos(this.angleOffset)*this.speed*0.2*dt; this.y+=Math.sin(this.angleOffset)*this.speed*0.2*dt; break; }
                this.aggroed=true;
                if (distP<=this.meleeRange&&this.attackStateTimer<=0){ this.attackState='windup'; this.attackStateTimer=0.25; break; }
                let moveAng=angP;
                if (this.behavior==='erratic'){ this.angleOffset+=(Math.random()-0.5)*dt*11; moveAng+=Math.sin(this.angleOffset)*1.8; }
                else if (this.behavior==='flank'){ this.angleOffset+=dt*0.55; moveAng=angP+(Math.PI/3)*(Math.sin(this.angleOffset)>=0?1:-1); }
                else { this.angleOffset+=(Math.random()-0.5)*dt*3; moveAng+=Math.sin(this.angleOffset)*0.25; }
                const brake=this.meleeRange*1.6;
                const sM=distP<brake?0.35+0.65*(distP/brake):1.0;
                this.x+=Math.cos(moveAng)*this.speed*sM*dt; this.y+=Math.sin(moveAng)*this.speed*sM*dt;
                break;
            }
            case 'windup': if(this.attackStateTimer<=0){ this.attackState='strike'; this.attackStateTimer=0.13; this.strikeHit=false; } break;
            case 'strike': {
                this.x+=Math.cos(angP)*this.speed*3.2*dt; this.y+=Math.sin(angP)*this.speed*3.2*dt;
                if (!this.strikeHit&&distP<this.meleeRange+14){ player.takeDamage(this.damage,this.name); this.strikeHit=true; }
                if (this.attackStateTimer<=0){ this.attackState='recoil'; this.attackStateTimer=0.35; this.x-=Math.cos(angP)*28; this.y-=Math.sin(angP)*28; }
                break;
            }
            case 'recoil': {
                this.x+=Math.cos(angP+Math.PI)*this.speed*0.65*dt; this.y+=Math.sin(angP+Math.PI)*this.speed*0.65*dt;
                if (this.attackStateTimer<=0){ this.attackState='approach'; this.attackStateTimer=0.4+Math.max(0,(6-player.level)*0.12); }
                break;
            }
        }
        resolveTreeCollision(this);
        resolveBuildingWallCollision(this);
    }

    _specialUpdate(dt, distP, angP) {
        const player = S.player;
        switch(this.typeId) {
            case 'scorpion': {
                if (this._burrowState==='surface') {
                    this._burrowTimer-=dt;
                    if (this._burrowTimer<=0&&this.aggroed) {
                        this._burrowState='burrowing'; this._burrowTimer=1.2;
                        this.alpha=0; this.color='transparent';
                    } else if (distP>20) {
                        if (!this.aggroed&&distP>this.aggroRange) { this.angleOffset+=dt; this.x+=Math.cos(this.angleOffset)*this.speed*0.2*dt; this.y+=Math.sin(this.angleOffset)*this.speed*0.2*dt; return; }
                        this.aggroed=true;
                        this.x+=Math.cos(angP)*this.speed*dt; this.y+=Math.sin(angP)*this.speed*dt;
                    }
                } else if (this._burrowState==='burrowing') {
                    this._burrowTimer-=dt;
                    if (this._burrowTimer<=0) {
                        const ang=Math.random()*Math.PI*2;
                        this.x=player.x+Math.cos(ang)*(35+Math.random()*35); this.y=player.y+Math.sin(ang)*(35+Math.random()*35);
                        this._burrowState='emerging'; this._burrowTimer=0.55;
                        showFloatingText(this.x,this.y-20,'!','#ff8800');
                    }
                } else if (this._burrowState==='emerging') {
                    this._burrowTimer-=dt;
                    if (this._burrowTimer<=0) {
                        this.alpha=1; this.color='#d4a54a';
                        if (distP<55) player.takeDamage(this.damage*1.5,this.name);
                        createParticles(this.x,this.y,'#c8943a',8);
                        this._burrowState='surface'; this._burrowTimer=6+Math.random()*4;
                    }
                }
                break;
            }
            case 'icegolem': {
                if (distP<90&&!player._slowed) {
                    player._slowed=true; player._slowTimer=0.4;
                    if (!player._origSpeed){ player._origSpeed=player.speed; player.speed=player._origSpeed*0.55; }
                }
                break;
            }
            case 'elemental': {
                if (Math.random()<0.25) createParticles(this.x+(Math.random()-0.5)*18,this.y+(Math.random()-0.5)*18,'#ff4400',2);
                break;
            }
            case 'minotaur': {
                if (this._chargeState==='idle') {
                    this._chargeTimer-=dt;
                    if (this._chargeTimer<=0&&this.aggroed&&distP<700) {
                        this._chargeState='windup'; this._chargeTimer=1.1;
                        this._chargeTarget={x:player.x,y:player.y};
                        showFloatingText(this.x,this.y-38,'CHARGE!','#ff4400');
                    }
                } else if (this._chargeState==='windup') {
                    this._chargeTimer-=dt;
                    if (this._chargeTimer<=0){ this._chargeState='charging'; this._chargeTimer=0.85; }
                } else if (this._chargeState==='charging') {
                    const cAng=Math.atan2(this._chargeTarget.y-this.y,this._chargeTarget.x-this.x);
                    this.x+=Math.cos(cAng)*this.speed*4.5*dt; this.y+=Math.sin(cAng)*this.speed*4.5*dt;
                    this._chargeTimer-=dt;
                    if (distP<44){ player.takeDamage(this.damage*2,this.name); this._chargeState='idle'; this._chargeTimer=8+Math.random()*4; }
                    if (this._chargeTimer<=0){ this._chargeState='idle'; this._chargeTimer=7+Math.random()*4; }
                }
                break;
            }
            case 'snorflaxia': {
                // Phase 2: when below 50% HP, unleash spread volleys and boost speed.
                this._volleyTimer = (this._volleyTimer || 0) - dt;
                const phase2 = this.hp < this.maxHp * 0.5;
                if (phase2 && !this._enragedAnnounced) {
                    this._enragedAnnounced = true;
                    this.speed = this.baseSpeed * 1.5;
                    showFloatingText(this.x, this.y-50, '"Now I am SLIGHTLY MORE disappointed."', '#ff66ff');
                }
                if (this._volleyTimer <= 0 && distP < 600) {
                    this._volleyTimer = phase2 ? 1.8 : 3.0;
                    const shots = phase2 ? 7 : 5;
                    const spread = phase2 ? Math.PI/2 : Math.PI/3;
                    for (let i=0; i<shots; i++) {
                        const off = (i/(shots-1) - 0.5) * spread;
                        S.projectiles.push(new Projectile(this.x, this.y, angP + off, false, this.damage, 'fireball', this.name));
                    }
                }
                break;
            }
        }
    }

    takeDamage(amount,isCrit=false) {
        const player = S.player;
        this.hp-=amount;
        showFloatingText(this.x,this.y,Math.floor(amount),isCrit?'yellow':'white',isCrit);
        this.aggroed=true; this.stunTimer=0.30;
        if (this.attackState==='windup'||this.attackState==='strike'){ this.attackState='recoil'; this.attackStateTimer=0.36; this.strikeHit=false; }
        if (this.typeId==='rat') { S.enemies.forEach(e=>{ if(e.typeId==='rat'&&Math.hypot(e.x-this.x,e.y-this.y)<180){ e.aggroed=true; } }); }
        const kbP=1200/Math.sqrt(this.maxHp);
        const kbDx=this.x-player.x, kbDy=this.y-player.y, kbD=Math.hypot(kbDx,kbDy)||1;
        this.knockbackVx=(kbDx/kbD)*kbP; this.knockbackVy=(kbDy/kbD)*kbP;
        createParticles(this.x,this.y,this.color,3);
        if (this.hp<=0) {
            player.gainXp(this.xpValue); player.kills++;
            questSystem.onKill(this.typeId);
            achievements.recordKill(this.typeId, !!this.isBoss);
            if (this.isBoss){
                showFloatingText(this.x,this.y-20,'BOSS DEFEATED!','gold');
                player.heal(player.maxHp*0.5);
                if (this.typeId === 'snorflaxia') {
                    // Endgame victory!
                    triggerVictory();
                }
            }
            else if (Math.random()<0.10) { S.items.push({ x:this.x,y:this.y,size:10,heal:Math.max(10,Math.floor(player.maxHp*0.15)),life:12,bob:Math.random()*Math.PI*2 }); }
            if (Math.random()<0.12 && player.classType!=='wizard') {
                // Knight always gets arrows, Beast always gets rocks.
                const myType = player.classType==='knight' ? 'arrow' : 'rock';
                S.items.push({ x:this.x+10,y:this.y,size:8,ammoType:myType,ammoCount:2+Math.floor(Math.random()*3),life:15,bob:Math.random()*Math.PI*2 });
            }
            createParticles(this.x,this.y,this.color,10);
            return true;
        }
        return false;
    }

    draw() {
        if (this.alpha===0) return;
        const { ctx, camera, canvas } = S;
        const drawX=this.x-camera.x, drawY=this.y-camera.y, s=this.size;
        if (drawX<-s*3||drawX>canvas.width+s*3||drawY<-s*3||drawY>canvas.height+s*3) return;

        if (this.attackState==='windup'||this._chargeState==='windup') {
            ctx.save(); ctx.globalAlpha=0.22+Math.sin(Date.now()/75)*0.1; ctx.fillStyle='#ff6d00';
            ctx.beginPath(); ctx.arc(drawX,drawY,s*1.2,0,Math.PI*2); ctx.fill(); ctx.restore();
        }
        ctx.fillStyle='#550000'; ctx.fillRect(drawX-s/2,drawY-s/2-9,s,4);
        ctx.fillStyle='#4CAF50'; ctx.fillRect(drawX-s/2,drawY-s/2-9,s*(this.hp/this.maxHp),4);
        if (this.isBoss){
            ctx.fillStyle='#FFD700'; ctx.font='bold 9px Courier New'; ctx.textAlign='center'; ctx.fillText('[BOSS]',drawX,drawY-s/2-12); ctx.textAlign='left';
        }

        ctx.fillStyle=this.color;
        switch(this.typeId) {
            case 'wisp': { const pulse=0.5+Math.sin(Date.now()/250)*0.3; ctx.globalAlpha=pulse*0.35; ctx.beginPath(); ctx.arc(drawX,drawY,s*1.6,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=pulse; ctx.beginPath(); ctx.arc(drawX,drawY,s,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; break; }
            case 'rat': { ctx.beginPath(); ctx.ellipse(drawX,drawY,s/2,s/3,0,0,Math.PI*2); ctx.fill(); ctx.strokeStyle=this.color; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(drawX-s/2,drawY); ctx.quadraticCurveTo(drawX-s*0.9,drawY-s/3,drawX-s,drawY+s/4); ctx.stroke(); break; }
            case 'bat': case 'harpy': { ctx.beginPath(); ctx.moveTo(drawX,drawY-s/2); ctx.lineTo(drawX+s/2,drawY+s/2); ctx.lineTo(drawX-s/2,drawY+s/2); ctx.fill(); ctx.globalAlpha=0.45; ctx.beginPath(); ctx.ellipse(drawX-s*0.9,drawY,s,s/3,-0.4,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(drawX+s*0.9,drawY,s,s/3,0.4,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; break; }
            case 'mushroom': { ctx.fillStyle='#827717'; ctx.fillRect(drawX-s/5,drawY-s/4,s*0.4,s/2); ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(drawX,drawY-s/4,s/2,Math.PI,0); ctx.fill(); ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(drawX-s/5,drawY-s/3,s/7,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(drawX+s/4,drawY-s/4,s/9,0,Math.PI*2); ctx.fill(); break; }
            case 'slime': { ctx.beginPath(); ctx.arc(drawX,drawY+s/4,s/2,Math.PI,0); ctx.fill(); ctx.globalAlpha=0.5; ctx.beginPath(); ctx.arc(drawX-s/4,drawY+s/8,s/5,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(drawX+s/4,drawY+s/6,s/7,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; break; }
            case 'wolfkin': { ctx.beginPath(); ctx.moveTo(drawX,drawY-s/2); ctx.lineTo(drawX+s/2,drawY); ctx.lineTo(drawX,drawY+s*0.65); ctx.lineTo(drawX-s/2,drawY); ctx.fill(); ctx.beginPath(); ctx.moveTo(drawX-s/5,drawY-s/2); ctx.lineTo(drawX-s/2,drawY-s); ctx.lineTo(drawX+s/6,drawY-s/2); ctx.fill(); break; }
            case 'wraith': { ctx.globalAlpha=0.75; ctx.beginPath(); ctx.moveTo(drawX,drawY-s/2); ctx.lineTo(drawX+s/2,drawY+s/2); ctx.lineTo(drawX-s/2,drawY+s/2); ctx.fill(); ctx.globalAlpha=0.3; ctx.beginPath(); ctx.arc(drawX,drawY+s/3,s/2,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; break; }
            case 'goblin': { ctx.fillRect(drawX-s/2,drawY-s/2,s,s); ctx.beginPath(); ctx.moveTo(drawX-s/2,drawY-s/3); ctx.lineTo(drawX-s,drawY-s*0.85); ctx.lineTo(drawX-s/5,drawY-s/2); ctx.fill(); ctx.beginPath(); ctx.moveTo(drawX+s/2,drawY-s/3); ctx.lineTo(drawX+s,drawY-s*0.85); ctx.lineTo(drawX+s/5,drawY-s/2); ctx.fill(); break; }
            case 'skeleton': { ctx.fillRect(drawX-s/2,drawY-s/2,s,s); ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1.5; for(let r=0;r<3;r++){ctx.beginPath();ctx.moveTo(drawX-s/2+2,drawY-s/3+r*s/3.5);ctx.lineTo(drawX+s/2-2,drawY-s/3+r*s/3.5);ctx.stroke();} break; }
            case 'troll': { ctx.fillRect(drawX-s/2,drawY-s/2,s,s); ctx.beginPath(); ctx.arc(drawX,drawY-s/2,s/3,Math.PI,0); ctx.fill(); break; }
            case 'golem': { ctx.beginPath(); ctx.moveTo(drawX,drawY-s/2); ctx.lineTo(drawX+s/2,drawY-s/4); ctx.lineTo(drawX+s/2,drawY+s/4); ctx.lineTo(drawX,drawY+s/2); ctx.lineTo(drawX-s/2,drawY+s/4); ctx.lineTo(drawX-s/2,drawY-s/4); ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(drawX-s/3,drawY-s/4); ctx.lineTo(drawX+s/3,drawY+s/3); ctx.stroke(); break; }
            case 'scorpion': { ctx.fillStyle='#d4a54a'; ctx.fillRect(drawX-s/2,drawY-s/3,s,s*0.6); ctx.fillStyle='#b8903a'; ctx.fillRect(drawX-s*0.95,drawY-s/4,s/2,s/4); ctx.fillRect(drawX+s/2,drawY-s/4,s/2,s/4); ctx.strokeStyle='#c8943a'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(drawX+s/3,drawY-s/4); ctx.quadraticCurveTo(drawX+s*0.8,drawY-s*0.95,drawX+s/2,drawY-s); ctx.stroke(); ctx.fillStyle='#ff6600'; ctx.beginPath(); ctx.arc(drawX+s/2,drawY-s,4,0,Math.PI*2); ctx.fill(); break; }
            case 'icegolem': { ctx.fillStyle='#7eb8e8'; ctx.fillRect(drawX-s/2,drawY-s/2,s,s); ctx.strokeStyle='#b0d8f8'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(drawX,drawY-s/2); ctx.lineTo(drawX,drawY+s/2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(drawX-s/2,drawY); ctx.lineTo(drawX+s/2,drawY); ctx.stroke(); const glow=0.18+Math.sin(Date.now()/400)*0.07; ctx.globalAlpha=glow; ctx.fillStyle='#a0d0ff'; ctx.beginPath(); ctx.arc(drawX,drawY,s*1.1,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; break; }
            case 'minotaur': { ctx.fillRect(drawX-s/2,drawY-s/2,s,s); ctx.beginPath(); ctx.moveTo(drawX-s/2,drawY-s/2); ctx.lineTo(drawX-s*0.9,drawY-s*1.15); ctx.lineTo(drawX-s/5,drawY-s/2); ctx.fill(); ctx.beginPath(); ctx.moveTo(drawX+s/2,drawY-s/2); ctx.lineTo(drawX+s*0.9,drawY-s*1.15); ctx.lineTo(drawX+s/5,drawY-s/2); ctx.fill(); if(this._chargeState==='windup'||this._chargeState==='charging'){ ctx.fillStyle='#ff2200'; ctx.globalAlpha=0.5; ctx.fillRect(drawX-s/2,drawY-s/2,s,s); ctx.globalAlpha=1; } break; }
            case 'medusa': { ctx.beginPath(); ctx.arc(drawX,drawY,s/2,0,Math.PI*2); ctx.fill(); ctx.strokeStyle=this.color; ctx.lineWidth=2; for(let i=0;i<6;i++){ const a=(i/6)*Math.PI*2+Date.now()/1200; ctx.beginPath(); ctx.moveTo(drawX+Math.cos(a)*s/2,drawY+Math.sin(a)*s/2); ctx.lineTo(drawX+Math.cos(a)*s*1.1,drawY+Math.sin(a)*s*1.1); ctx.stroke(); } break; }
            case 'hydra': { ctx.beginPath(); ctx.arc(drawX,drawY+s/4,s*0.55,0,Math.PI*2); ctx.fill(); [-0.8,-0.25,0.25,0.8].forEach(a=>{ ctx.beginPath(); ctx.arc(drawX+Math.sin(a)*s*0.8,drawY-s/3,s/4,0,Math.PI*2); ctx.fill(); }); break; }
            case 'elemental': { const fl=0.7+Math.sin(Date.now()/80+this.x)*0.2; ctx.fillStyle=`rgba(255,${Math.floor(90+Math.sin(Date.now()/60)*55)},0,${fl})`; ctx.beginPath(); ctx.arc(drawX,drawY,s/2,0,Math.PI*2); ctx.fill(); ctx.fillStyle=`rgba(255,210,0,${fl*0.6})`; ctx.beginPath(); ctx.arc(drawX,drawY-4,s/3,0,Math.PI*2); ctx.fill(); ctx.fillStyle='rgba(255,255,200,0.9)'; ctx.beginPath(); ctx.arc(drawX,drawY-6,s/5,0,Math.PI*2); ctx.fill(); break; }
            case 'dragon': { ctx.fillRect(drawX-s/2,drawY-s/2,s,s); ctx.globalAlpha=0.55; ctx.beginPath(); ctx.moveTo(drawX-s/3,drawY); ctx.lineTo(drawX-s*2.2,drawY-s); ctx.lineTo(drawX-s,drawY+s/2); ctx.fill(); ctx.beginPath(); ctx.moveTo(drawX+s/3,drawY); ctx.lineTo(drawX+s*2.2,drawY-s); ctx.lineTo(drawX+s,drawY+s/2); ctx.fill(); ctx.globalAlpha=1; ctx.fillStyle='#FFC107'; ctx.beginPath(); ctx.moveTo(drawX-s/3,drawY-s/2); ctx.lineTo(drawX-s/2,drawY-s*1.3); ctx.lineTo(drawX-s/8,drawY-s/2); ctx.fill(); ctx.beginPath(); ctx.moveTo(drawX+s/3,drawY-s/2); ctx.lineTo(drawX+s/2,drawY-s*1.3); ctx.lineTo(drawX+s/8,drawY-s/2); ctx.fill(); break; }
            case 'lich': { ctx.beginPath(); ctx.arc(drawX,drawY+s/4,s/2,0,Math.PI); ctx.fill(); ctx.beginPath(); ctx.moveTo(drawX-s/2,drawY); ctx.lineTo(drawX+s/2,drawY); ctx.lineTo(drawX,drawY-s*0.8); ctx.fill(); ctx.fillStyle='#E040FB'; ctx.globalAlpha=0.75+Math.sin(Date.now()/180)*0.25; ctx.beginPath(); ctx.arc(drawX,drawY-s*0.25,s/5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; break; }
            case 'snorflaxia': {
                const pulse2=0.6+Math.sin(Date.now()/150)*0.3;
                ctx.fillStyle=`rgba(140,0,255,${pulse2})`; ctx.beginPath(); ctx.arc(drawX,drawY,s*0.55,0,Math.PI*2); ctx.fill();
                for(let i=0;i<8;i++){ const a=(i/8)*Math.PI*2+Date.now()/900; ctx.strokeStyle=`rgba(200,0,255,${pulse2*0.7})`; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(drawX+Math.cos(a)*s*0.55,drawY+Math.sin(a)*s*0.55); ctx.lineTo(drawX+Math.cos(a)*s*1.2,drawY+Math.sin(a)*s*1.2); ctx.stroke(); }
                ctx.fillStyle='#fff'; ctx.font='bold 10px Courier New'; ctx.textAlign='center'; ctx.fillText('SNORFLAXIA',drawX,drawY-s-6); ctx.textAlign='left';
                break;
            }
            default: { ctx.fillRect(drawX-s/2,drawY-s/2,s,s); }
        }
    }
}

// ── Projectile ───────────────────────────────────────────────
export class Projectile {
    constructor(x,y,angle,isPlayer,damage,type='fireball',shooterName=null) {
        this.x=x; this.y=y; this.angle=angle; this.isPlayer=isPlayer; this.damage=damage;
        this.type=type; this.shooterName=shooterName;
        this.speed=type==='arrow'?525:(type==='rock'?325:405);
        this.size=type==='arrow'?5:(type==='rock'?9:6);
        this.color=!isPlayer?'#FF5722':(type==='arrow'?'#FFD700':(type==='rock'?'#A1887F':'#00BCD4'));
        this.life=type==='rock'?1.0:1.5;
    }
    update(dt) {
        const player = S.player;
        this.x+=Math.cos(this.angle)*this.speed*dt; this.y+=Math.sin(this.angle)*this.speed*dt; this.life-=dt;
        if (this.isPlayer) {
            for (let i=0;i<S.enemies.length;i++) { const e=S.enemies[i]; if(Math.hypot(e.x-this.x,e.y-this.y)<e.size/2+this.size){ e.takeDamage(this.damage); createParticles(this.x,this.y,this.color,5); return true; } }
            for (let i=0;i<S.archerTowers.length;i++) { const t=S.archerTowers[i]; if(Math.hypot(t.x-this.x,t.y-this.y)<t.tw/2+this.size+6){ t.takeDamage(this.damage); createParticles(this.x,this.y,this.color,5); return true; } }
        } else {
            if (Math.hypot(player.x-this.x,player.y-this.y)<player.size/2+this.size){ player.takeDamage(this.damage,this.shooterName); createParticles(this.x,this.y,this.color,5); return true; }
        }
        return this.life<=0;
    }
    draw() {
        const { ctx, camera } = S;
        const dx=this.x-camera.x, dy=this.y-camera.y;
        if (this.type==='arrow') {
            ctx.save(); ctx.translate(dx,dy); ctx.rotate(this.angle);
            ctx.strokeStyle='#FFD700'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(7,0); ctx.stroke();
            ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(5,-3); ctx.lineTo(5,3); ctx.fill(); ctx.restore();
        } else if (this.type==='rock') {
            ctx.fillStyle='#8D6E63'; ctx.beginPath(); ctx.arc(dx,dy,this.size,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#BCAAA4'; ctx.beginPath(); ctx.arc(dx-2,dy-3,this.size*0.4,0,Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(dx,dy,this.size,0,Math.PI*2); ctx.fill();
            if (this.isPlayer){ ctx.globalAlpha=0.3; ctx.beginPath(); ctx.arc(dx,dy,this.size*2,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
        }
    }
}

// ── Archer Tower ─────────────────────────────────────────────
export class ArcherTower {
    constructor(x,y) {
        const player = S.player;
        this.x=x; this.y=y; this.tw=28; this.th=52;
        this.maxHp=180+player.level*22; this.hp=this.maxHp;
        this.lastShotTime=0; this.shotCooldown=2600; this.range=320;
        this.damage=10+player.level*2; this.dead=false; this.name='Archer Tower';
        this.shootAnim=0;
    }
    update(dt) {
        const player = S.player;
        if (this.shootAnim>0) this.shootAnim-=dt;
        const dist=Math.hypot(player.x-this.x,player.y-this.y);
        if (dist>this.range) return;
        const now=performance.now();
        if (now-this.lastShotTime<this.shotCooldown) return;
        const ang=Math.atan2(player.y-this.y,player.x-this.x);
        S.projectiles.push(new Projectile(this.x,this.y,ang,false,this.damage,'arrow',this.name));
        this.lastShotTime=now; this.shootAnim=0.25;
    }
    takeDamage(amount,isCrit=false) {
        this.hp-=amount; showFloatingText(this.x,this.y,Math.floor(amount),isCrit?'yellow':'white',isCrit);
        createParticles(this.x,this.y,'#78909C',3);
        if (this.hp<=0) {
            this.dead=true;
            S.chests.push({ x:this.x,y:this.y,opened:false, loot:Math.random()<0.5?ARMOR_ITEMS[1]:RING_ITEMS[1] });
            showFloatingText(this.x,this.y-20,'Tower Destroyed!','#FFA726');
        }
    }
    draw() {
        const { ctx, camera, canvas } = S;
        const dx=this.x-camera.x, dy=this.y-camera.y;
        if (dx<-60||dx>canvas.width+60||dy<-60||dy>canvas.height+60) return;
        ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(dx-this.tw/2+3,dy-this.th/2+3,this.tw,this.th);
        ctx.fillStyle='#546E7A'; ctx.fillRect(dx-this.tw/2,dy-this.th/2,this.tw,this.th);
        ctx.fillStyle='#607D8B'; ctx.fillRect(dx-this.tw/2,dy-this.th/2,this.tw,10);
        ctx.fillStyle='rgba(255,255,255,0.06)';
        for(let r=0;r<this.th;r+=12){ctx.fillRect(dx-this.tw/2,dy-this.th/2+r,this.tw,6);}
        ctx.fillStyle='#455A64'; ctx.fillRect(dx-this.tw/2-4,dy-this.th/2-8,this.tw+8,8);
        ctx.fillStyle='#37474F'; ctx.fillRect(dx-this.tw/2-6,dy-this.th/2-14,10,8); ctx.fillRect(dx+this.tw/2-4,dy-this.th/2-14,10,8);
        if(this.shootAnim>0){ctx.fillStyle='rgba(255,200,0,0.7)';ctx.beginPath();ctx.arc(dx,dy-this.th/2-16,4,0,Math.PI*2);ctx.fill();}
        ctx.fillStyle='#222'; ctx.fillRect(dx-6,dy-this.th/2+10,12,14);
        ctx.fillStyle='red'; ctx.fillRect(dx-this.tw/2,dy-this.th/2-22,this.tw,4);
        ctx.fillStyle='#4CAF50'; ctx.fillRect(dx-this.tw/2,dy-this.th/2-22,this.tw*(this.hp/this.maxHp),4);
    }
}
