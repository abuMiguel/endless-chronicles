// Global state and constants
const GAME_TITLE = "RetroRoguelikeEndless";

// DOM Elements setup
const ui = {
    startScreen: document.getElementById('start-screen'),
    classSelection: document.getElementById('class-selection'),
    hud: document.getElementById('hud'),
    mobileControls: document.getElementById('mobile-controls'),
    actionBtn: document.getElementById('action-btn'),
    levelUpScreen: document.getElementById('level-up-screen'),
    pauseMenu: document.getElementById('pause-menu'),
    gameOverScreen: document.getElementById('game-over-screen'),
    bestiaryScreen: document.getElementById('bestiary-screen'),
    
    // Buttons
    startNewBtn: document.getElementById('start-new-btn'),
    loadSaveBtn: document.getElementById('load-save-btn'),
    menuBtn: document.getElementById('menu-btn'),
    resumeBtn: document.getElementById('resume-btn'),
    saveBtn: document.getElementById('save-btn'),
    quitBtn: document.getElementById('quit-btn'),
    restartBtn: document.getElementById('restart-btn'),
    showBestiaryBtn: document.getElementById('show-bestiary-btn'),
    menuBestiaryBtn: document.getElementById('menu-bestiary-btn'),
    closeBestiaryBtn: document.getElementById('close-bestiary-btn'),
    
    // HUD Elements
    playerNameDisplay: document.getElementById('player-name-display'),
    hpBarFill: document.getElementById('hp-bar-fill'),
    hpText: document.getElementById('hp-text'),
    manaContainer: document.getElementById('mana-container'),
    manaBarFill: document.getElementById('mana-bar-fill'),
    manaText: document.getElementById('mana-text'),
            xpBarFill: document.getElementById('xp-bar-fill'),
            scoreDisplay: document.getElementById('score-display'),
            levelDisplay: document.getElementById('level-display'),
    
    // Class Cards
    classCards: document.querySelectorAll('.class-card'),
    difficultySelect: document.getElementById('difficulty-select'),
    
    // Others
    saveMsg: document.getElementById('save-msg'),
    bestiaryBody: document.getElementById('bestiary-body'),
    rangedBtn: document.getElementById('ranged-btn'),
    ammoDisplay: document.getElementById('ammo-display'),
    ammoCount: document.getElementById('ammo-count'),
    ammoLabel: document.getElementById('ammo-label'),
    equipmentDisplay: document.getElementById('equipment-display'),
    armorDisplay: document.getElementById('armor-display'),
    ringDisplay: document.getElementById('ring-display'),
    shieldDisplay: document.getElementById('shield-display'),
    statsDisplay:  document.getElementById('stats-display'),
    statHp:        document.getElementById('stat-hp'),
    statDmg:       document.getElementById('stat-dmg'),
    statSpd:       document.getElementById('stat-spd'),
    statAbility:   document.getElementById('stat-ability'),
    statAbilityLabel: document.getElementById('stat-ability-label'),
};

let selectedClass = null;

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

ctx.imageSmoothingEnabled = false;

const GameState = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', LEVEL_UP: 'level_up', GAME_OVER: 'game_over' };
let currentState = GameState.MENU;
let lastTime = 0;
let animationFrameId = null;
const keys = {};
const camera = { x: 0, y: 0 };

document.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys[k] = true;
    if (e.key === 'Escape' && currentState === GameState.PLAYING) pauseGame();
    if (e.key === ' ' && currentState === GameState.PLAYING) {
        e.preventDefault();
        player.attack();
    }
    if ((e.key === 'e' || e.key === 'E') && currentState === GameState.PLAYING) {
        e.preventDefault();
        player.rangedAttack();
    }
    if (e.key === 'Shift' && currentState === GameState.PLAYING) {
        e.preventDefault();
        player.activateShield();
    }
});
document.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys[k] = false;
});

// Clear all held keys when window loses focus (prevents stuck movement)
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// Suppress right-click context menu everywhere during gameplay
document.addEventListener('contextmenu', (e) => {
    if (currentState !== GameState.MENU) e.preventDefault();
});

// Mouse: left click = melee, right click = ranged
canvas.addEventListener('mousedown', (e) => {
    if (currentState !== GameState.PLAYING) return;
    if (e.button === 0) player.attack();
    if (e.button === 2) player.rangedAttack();
});

const spawnManager = {
    spawnTimer: 0,
    baseSpawnInterval: 1.2,
    lastBossLevel: 0,
    bossSpawned: false,
    
    update(dt) {
        this.spawnTimer -= dt;
        
        const diff = ui.difficultySelect.value;
        const intervalMult = diff === 'easy' ? 2.0 : (diff === 'hard' ? 0.8 : 1.0);
        const spawnInterval = Math.max(0.2, (this.baseSpawnInterval - (player.level * 0.04)) * intervalMult);
        
        if (this.spawnTimer <= 0) {
            this.spawnEnemy();
            this.spawnTimer = spawnInterval;
        }
        
        if (player.level > this.lastBossLevel && player.level % 5 === 0 && !this.bossSpawned) {
            this.spawnBoss();
            this.bossSpawned = true;
            showFloatingText(player.x, player.y - 80, `LEVEL ${player.level}: BOSS APPROACHING!`, "red");
        } else if (player.level > this.lastBossLevel && player.level % 5 !== 0) {
            this.bossSpawned = false;
            this.lastBossLevel = player.level;
        }
    },
    
    spawnEnemy() {
        const diff = ui.difficultySelect.value;
        const maxEnemies = diff === 'easy'
            ? Math.min(12, 3 + Math.floor(player.level * 0.8))
            : (diff === 'hard' ? Math.min(60, 6 + player.level * 3) : Math.min(40, 4 + player.level * 2));
        if (enemies.length >= maxEnemies) return;

        // Terrain affinity check
        const nearBuildings = WorldGen.getBuildingsNear(player.x, player.y, 420);
        const nearBuilding  = nearBuildings.length > 0;
        const nearTrees     = WorldGen.getTreesInRect(player.x, player.y, 200, 200).length > 3;

        // Weighted pool: newer unlocks ramp up, old ones fade out
        const available = MonsterTypes.filter(m => !m.isBoss && player.level >= m.minLevel);
        if (!available.length) return;

        let pool = [];
        for (const m of available) {
            const lvAbove = player.level - m.minLevel;
            let w = lvAbove <= 2
                ? (0.3 + lvAbove * 0.35)
                : Math.max(0.05, 1.0 - (lvAbove - 2) * 0.08);
            if (nearBuilding && m.buildingAffinity) w *= 2.5;
            if (nearTrees    && m.treeAffinity)     w *= 2.5;
            pool.push({ type: m, weight: w });
        }
        const totalW = pool.reduce((s, e) => s + e.weight, 0);
        let r = Math.random() * totalW;
        let chosen = pool[0].type;
        for (const e of pool) { r -= e.weight; if (r <= 0) { chosen = e.type; break; } }

        // Spawn near a building stronghold or on the standard ring
        let x, y;
        if (nearBuilding && Math.random() < 0.45) {
            const b = nearBuildings[0];
            const a = Math.random() * Math.PI * 2;
            x = b.wx + Math.cos(a) * (b.w / 2 + 55 + Math.random() * 90);
            y = b.wy + Math.sin(a) * (b.h / 2 + 55 + Math.random() * 90);
        } else {
            const a = Math.random() * Math.PI * 2;
            const dist = Math.max(canvas.width, canvas.height) / 2 + 100;
            x = player.x + Math.cos(a) * dist;
            y = player.y + Math.sin(a) * dist;
        }
        enemies.push(new Enemy(x, y, chosen));
    },

    spawnBoss() {
        const angle = Math.random() * Math.PI * 2;
        const dist  = 320;
        const x = player.x + Math.cos(angle) * dist;
        const y = player.y + Math.sin(angle) * dist;
        const bossTypes = MonsterTypes.filter(m => m.isBoss);
        const bossType  = bossTypes[Math.floor(Math.random() * bossTypes.length)];
        const boss = new Enemy(x, y, bossType);
        boss.maxHp *= (1 + player.level * 0.1);
        boss.hp = boss.maxHp;
        enemies.push(boss);
    }
};

const setupMobileButton = (buttonId, keyName) => {
    const btn = document.getElementById(buttonId);
    if (!btn) {
        return;
    }

    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyName] = true; });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyName] = false; });
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); keys[keyName] = true; });
    btn.addEventListener('mouseup', (e) => { e.preventDefault(); keys[keyName] = false; });
    btn.addEventListener('mouseleave', (e) => { keys[keyName] = false; });
};

setupMobileButton('btn-up', 'w');
setupMobileButton('btn-down', 's');
setupMobileButton('btn-left', 'a');
setupMobileButton('btn-right', 'd');

ui.actionBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (currentState === GameState.PLAYING) player.attack();
});
ui.actionBtn.addEventListener('mousedown', (e) => {
    if (currentState === GameState.PLAYING) player.attack();
});
ui.rangedBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (currentState === GameState.PLAYING) player.rangedAttack();
});
ui.rangedBtn.addEventListener('mousedown', () => {
    if (currentState === GameState.PLAYING) player.rangedAttack();
});

const Classes = {
    human: {
        name: "Human Knight", color: "var(--accent-color)", size: 24,
        baseHp: 150, baseDmg: 15, baseSpeed: 180, attackCooldown: 350, attackRange: 40,
        rangedCooldown: 1200,
        abilityName: "Block", manaReq: 0,
        colorFill: "#A5D6A7", outline: "#2E7D32"
    },
    wizard: {
        name: "Arcane Wizard", color: "var(--wizard-color)", size: 20,
        baseHp: 80, baseDmg: 10, baseSpeed: 160, attackCooldown: 580, attackRange: 30,
        rangedCooldown: 2800,
        abilityName: "Fireball", manaReq: 30, baseMana: 100, manaRegen: 6,
        colorFill: "#CE93D8", outline: "#6A1B9A"
    },
    beast: {
        name: "Feral Beast", color: "var(--beast-color)", size: 26,
        baseHp: 120, baseDmg: 20, baseSpeed: 220, attackCooldown: 200, attackRange: 30,
        rangedCooldown: 2000,
        abilityName: "Lifesteal", manaReq: 0,
        colorFill: "#FFCC80", outline: "#E65100"
    }
};

const MonsterTypes = [
    // Tier 1 — level 1+
    { id: "rat",      name: "Giant Rat",       minLevel: 1,  hp: 28,  dmg: 5,  speed: 105, xp: 10,  color: "#795548", size: 12, behavior: "chase",   desc: "Fast but weak. Travels in packs." },
    { id: "wisp",     name: "Will-o'-Wisp",    minLevel: 4,  hp: 18,  dmg: 7,  speed: 165, xp: 13,  color: "#80DEEA", size: 9,  behavior: "erratic", desc: "Ghostly light that confuses travellers." },
    // Tier 2 — level 3+
    { id: "bat",      name: "Vampire Bat",      minLevel: 3,  hp: 22,  dmg: 9,  speed: 155, xp: 18,  color: "#607D8B", size: 11, behavior: "erratic", desc: "Swoops unpredictably. Hard to hit." },
    { id: "mushroom", name: "Fungal Creeper",   minLevel: 3,  hp: 55,  dmg: 10, speed: 55,  xp: 20,  color: "#AED581", size: 22, behavior: "chase",   desc: "Slow tank lurking near the trees.", treeAffinity: true },
    // Tier 3 — level 5+
    { id: "slime",    name: "Toxic Slime",      minLevel: 5,  hp: 65,  dmg: 12, speed: 60,  xp: 25,  color: "#8BC34A", size: 24, behavior: "chase",   desc: "Slow, high HP. Leaves toxic residue." },
    { id: "wolfkin",  name: "Forest Wolfkin",   minLevel: 5,  hp: 50,  dmg: 14, speed: 140, xp: 28,  color: "#8D6E63", size: 17, behavior: "flank",   desc: "Pack hunter that prowls the forest.", treeAffinity: true },
    // Tier 4 — level 7+
    { id: "goblin",   name: "Goblin Rogue",     minLevel: 7,  hp: 50,  dmg: 16, speed: 125, xp: 32,  color: "#4CAF50", size: 18, behavior: "flank",   desc: "Crafty flanker that raids strongholds.", buildingAffinity: true },
    { id: "wraith",   name: "Shadow Wraith",    minLevel: 7,  hp: 38,  dmg: 20, speed: 135, xp: 38,  color: "#7E57C2", size: 16, behavior: "erratic", desc: "Ethereal horror that passes unseen." },
    // Tier 5 — level 9+
    { id: "skeleton", name: "Skeleton Archer",  minLevel: 9,  hp: 45,  dmg: 12, speed: 80,  xp: 35,  color: "#E0E0E0", size: 18, behavior: "ranged",  range: 260, desc: "Fires from a distance. Retreats when cornered.", buildingAffinity: true },
    { id: "troll",    name: "Cave Troll",       minLevel: 9,  hp: 140, dmg: 22, speed: 70,  xp: 50,  color: "#78909C", size: 30, behavior: "chase",   desc: "Massive brute that guards ruins.", buildingAffinity: true },
    // Tier 6 — level 12+
    { id: "harpy",    name: "Harpy",            minLevel: 12, hp: 60,  dmg: 18, speed: 175, xp: 55,  color: "#F48FB1", size: 17, behavior: "erratic", desc: "Swooping predator with razor talons." },
    { id: "golem",    name: "Stone Golem",      minLevel: 12, hp: 200, dmg: 28, speed: 50,  xp: 70,  color: "#90A4AE", size: 36, behavior: "chase",   desc: "Near-invincible guardian of ancient ruins.", buildingAffinity: true },
    // Tier 7 — level 15+
    { id: "minotaur", name: "Minotaur",         minLevel: 15, hp: 160, dmg: 32, speed: 95,  xp: 85,  color: "#BF360C", size: 32, behavior: "flank",   desc: "Charges with devastating power through strongholds.", buildingAffinity: true },
    { id: "medusa",   name: "Medusa",           minLevel: 15, hp: 80,  dmg: 25, speed: 85,  xp: 90,  color: "#26C6DA", size: 20, behavior: "ranged",  range: 300, desc: "Petrifying gaze. Lethal at range." },
    // Tier 8 — level 18+
    { id: "hydra",    name: "Hydra",            minLevel: 18, hp: 260, dmg: 35, speed: 65,  xp: 120, color: "#2E7D32", size: 38, behavior: "chase",   desc: "Multi-headed terror of the deep woods.", treeAffinity: true },
    // Bosses
    { id: "dragon",   name: "Lesser Dragon",    minLevel: 1,  hp: 400, dmg: 35, speed: 95,  xp: 200, color: "#F44336", size: 44, behavior: "flank",   isBoss: true, desc: "Ancient winged terror. Circles prey before striking." },
    { id: "lich",     name: "The Lich",         minLevel: 1,  hp: 320, dmg: 28, speed: 75,  xp: 250, color: "#B39DDB", size: 38, behavior: "ranged",  range: 290, isBoss: true, desc: "Undead sorcerer. Fires dark magic from a distance." },
];

// --- World Generation (deterministic infinite terrain) ---
const WorldGen = {
    TREE_GRID: 130,
    TREE_RADIUS: 17,
    BUILDING_GRID: 900,

    _hash(a, b) {
        return Math.abs(Math.sin(a * 127.1 + b * 311.7) * 43758.5453) % 1;
    },

    hasTree(gx, gy) {
        if (Math.abs(gx) <= 2 && Math.abs(gy) <= 2) return false; // safe start zone
        return this._hash(gx, gy) < 0.13;
    },

    treePos(gx, gy) {
        const ox = (this._hash(gx + 0.1, gy + 0.5) - 0.5) * 70;
        const oy = (this._hash(gx + 0.3, gy + 0.7) - 0.5) * 70;
        return { x: gx * this.TREE_GRID + ox, y: gy * this.TREE_GRID + oy };
    },

    getTreesInRect(cx, cy, halfW, halfH) {
        const result = [];
        const minGx = Math.floor((cx - halfW) / this.TREE_GRID) - 1;
        const maxGx = Math.ceil((cx + halfW)  / this.TREE_GRID) + 1;
        const minGy = Math.floor((cy - halfH) / this.TREE_GRID) - 1;
        const maxGy = Math.ceil((cy + halfH)  / this.TREE_GRID) + 1;
        for (let gx = minGx; gx <= maxGx; gx++)
            for (let gy = minGy; gy <= maxGy; gy++)
                if (this.hasTree(gx, gy)) result.push(this.treePos(gx, gy));
        return result;
    },

    getBuilding(gx, gy) {
        if (gx === 0 && gy === 0) return null;
        const h = this._hash(gx * 3.7, gy * 2.1);
        if (h < 0.025) return { type: 'fort',  wx: gx * this.BUILDING_GRID, wy: gy * this.BUILDING_GRID, w: 150, h: 150 };
        if (h < 0.07)  return { type: 'tower', wx: gx * this.BUILDING_GRID, wy: gy * this.BUILDING_GRID, w:  26, h:  26 };
        return null;
    },

    getBuildingsNear(wx, wy, radius) {
        const result = [];
        const minGx = Math.floor((wx - radius) / this.BUILDING_GRID) - 1;
        const maxGx = Math.ceil((wx + radius)  / this.BUILDING_GRID) + 1;
        const minGy = Math.floor((wy - radius) / this.BUILDING_GRID) - 1;
        const maxGy = Math.ceil((wy + radius)  / this.BUILDING_GRID) + 1;
        for (let gx = minGx; gx <= maxGx; gx++)
            for (let gy = minGy; gy <= maxGy; gy++) {
                const b = this.getBuilding(gx, gy);
                if (b) result.push(b);
            }
        return result;
    }
};

// Populate Bestiary
function buildBestiary() {
    ui.bestiaryBody.innerHTML = '';
    MonsterTypes.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:${m.color}; font-weight:bold;">${m.isBoss ? '👑 ' : ''}${m.name}</td>
            <td>${m.behavior}</td>
            <td>${m.speed > 130 ? 'Fast' : (m.speed < 75 ? 'Slow' : 'Avg')}</td>
            <td>${m.dmg > 20 ? 'High' : 'Low'}</td>
            <td>${m.isBoss ? '👑 Boss' : 'Lv ' + m.minLevel + '+'}</td>
            <td class="text-xs text-gray-400">${m.desc}</td>
        `;
        ui.bestiaryBody.appendChild(tr);
    });
}
buildBestiary();

class Entity {
    constructor(x, y, size, color) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
    }
    
    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
    }
}

class Player extends Entity {
    constructor(classData) {
        super(0, 0, classData.size, classData.colorFill);
        this.classType = classData.name.split(' ')[1].toLowerCase(); // knight, wizard, beast
        this.outlineColor = classData.outline;
        
        // Stats
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 50; // low bar so early levels come quickly
        this.score = 0;
        this.kills = 0;
        
        this.maxHp = classData.baseHp;
        this.hp = this.maxHp;
        
        this.damage = classData.baseDmg;
        this.speed = classData.baseSpeed;
        
        this.maxMana = classData.baseMana || 0;
        this.mana = this.maxMana;
        this.manaRegen = classData.manaRegen || 0;
        
        this.attackCooldown = classData.attackCooldown;
        this.lastAttackTime = 0;
        this.attackRange = classData.attackRange;
        this.rangedCooldown = classData.rangedCooldown;
        this.lastRangedTime = 0;
        this.arrows = this.classType === 'knight' ? 10 : 0;
        this.rocks  = this.classType === 'beast'  ? 8  : 0;
        
        // Abilities
        this.abilityPower = 1;
        this.isBlocking = false;
        
        // Equipment
        this.equipment = { armor: null, ring: null, shield: null };
        
        // Shield state
        this.shielding = false;
        this.shieldTimer = 0;
        this.shieldCooldownTimer = 0;
        
        // Visuals
        this.facing = 'right';
        this.facingAngle = 0; // radians: 0=right, PI/2=down, PI=left, -PI/2=up
        this.swingAngle = 0;
        this.isSwinging = false;
    }

    update(dt) {
        // Movement
        this.vx = 0;
        this.vy = 0;
        if(this.isBlocking) return; // Can't move while blocking

        if (keys.w || keys.ArrowUp) this.vy -= 1;
        if (keys.s || keys.ArrowDown) this.vy += 1;
        if (keys.a || keys.ArrowLeft) this.vx -= 1;
        if (keys.d || keys.ArrowRight) this.vx += 1;

        // Normalize diagonal movement
        if (this.vx !== 0 && this.vy !== 0) {
            const length = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            this.vx /= length;
            this.vy /= length;
        }

        // Update facing direction from movement
        if (this.vx !== 0 || this.vy !== 0) {
            this.facingAngle = Math.atan2(this.vy, this.vx);
            this.facing = this.vx >= 0 ? 'right' : 'left';
        }

        this.x += this.vx * this.speed * dt;
        this.y += this.vy * this.speed * dt;

        // Mana Regen
        if (this.maxMana > 0 && this.mana < this.maxMana) {
            this.mana += this.manaRegen * dt;
            if(this.mana > this.maxMana) this.mana = this.maxMana;
        }
        
        // World is truly infinite — no bounds clamping

        // Camera follow
        camera.x = this.x - canvas.width / 2;
        camera.y = this.y - canvas.height / 2;

        // Shield timers
        if (this.shielding) {
            this.shieldTimer -= dt;
            if (this.shieldTimer <= 0) {
                this.shielding = false;
                this.shieldTimer = 0;
                this.shieldCooldownTimer = this.equipment.shield ? this.equipment.shield.cooldown : 0;
                showFloatingText(this.x, this.y - 20, 'Shield down!', '#78909C');
            }
        } else if (this.shieldCooldownTimer > 0) {
            this.shieldCooldownTimer = Math.max(0, this.shieldCooldownTimer - dt);
        }
    }

    attack() {
        const now = performance.now();
        if (now - this.lastAttackTime < this.attackCooldown) return;

        if (this.classType === 'knight') {
            // Block briefly then sword swing
            this.isBlocking = true;
            this.color = "#81C784";
            setTimeout(() => {
                this.isBlocking = false;
                this.color = Classes.human.colorFill;
                this.swingWeapon();
            }, 200);
            this.lastAttackTime = now;
        } else {
            // Wizard staff bonk or Beast claw swipe
            this.swingWeapon();
            this.lastAttackTime = now;
        }
    }

    rangedAttack() {
        const now = performance.now();
        if (now - this.lastRangedTime < this.rangedCooldown) return;

        if (this.classType === 'knight') {
            if (this.arrows <= 0) {
                showFloatingText(this.x, this.y - 20, "No Arrows!", "#FFD700");
                return;
            }
            this.arrows--;
            this.fireProjectile('arrow', this.damage * 1.5);
            this.lastRangedTime = now;
            updateHUD();
        } else if (this.classType === 'wizard') {
            if (this.mana < 30) {
                showFloatingText(this.x, this.y - 20, "No Mana!", "#2196F3");
                return;
            }
            this.mana -= 30;
            this.fireProjectile('fireball', this.damage * this.abilityPower * 2.5);
            this.lastRangedTime = now;
            updateHUD();
        } else {
            if (this.rocks <= 0) {
                showFloatingText(this.x, this.y - 20, "No Rocks!", "#A1887F");
                return;
            }
            this.rocks--;
            this.fireProjectile('rock', this.damage * 2.0);
            this.lastRangedTime = now;
            updateHUD();
        }
    }

    fireProjectile(type, damage) {
        // Ring bonus applies to ranged too
        if (this.equipment.ring) damage = Math.floor(damage * this.equipment.ring.damageMult);
        projectiles.push(new Projectile(this.x, this.y, this.facingAngle, true, damage, type));
    }

    activateShield() {
        if (!this.equipment.shield) {
            showFloatingText(this.x, this.y - 20, 'No shield!', '#aaa');
            return;
        }
        if (this.shielding) return;
        if (this.shieldCooldownTimer > 0) {
            showFloatingText(this.x, this.y - 20, `Shield: ${Math.ceil(this.shieldCooldownTimer)}s`, '#78909C');
            return;
        }
        this.shielding = true;
        this.shieldTimer = this.equipment.shield.blockDuration;
        showFloatingText(this.x, this.y - 20, 'SHIELD!', '#29b6f6');
    }

    executeAutoAttack(enemy) {
        // Simplified attack for auto
        this.swingWeapon();
        this.lastAttackTime = performance.now();
    }

    swingWeapon() {
        this.isSwinging = true;
        
        // Detect hit
        enemies.forEach(enemy => {
            const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            // Direction check: enemy must be within a 180° arc in front of facingAngle
            const angleToEnemy = Math.atan2(enemy.y - this.y, enemy.x - this.x);
            const angleDiff = Math.atan2(Math.sin(angleToEnemy - this.facingAngle), Math.cos(angleToEnemy - this.facingAngle));
            const isCorrectDir = Math.abs(angleDiff) < Math.PI * 0.61; // ~110° arc each side
            
            if (dist <= this.attackRange + enemy.size + 12 && isCorrectDir) {
                let dmg = this.classType === 'wizard' ? Math.floor(this.damage * 0.6) : this.damage;
                // Ring bonus applies to melee
                if (this.equipment.ring) dmg = Math.floor(dmg * this.equipment.ring.damageMult);
                let isCrit = false;
                
                // Beast crit chance
                if(this.classType === 'beast' && Math.random() < 0.2) {
                    dmg *= 2;
                    isCrit = true;
                    // Lifesteal
                    this.heal(Math.floor(dmg * 0.2 * this.abilityPower));
                }
                
                enemy.takeDamage(dmg, isCrit);
                
                // Knockback
                const angle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                enemy.x += Math.cos(angle) * 20;
                enemy.y += Math.sin(angle) * 20;
            }
        });

        // Also hit Archer Towers in melee range
        archerTowers.forEach(tower => {
            const dist = Math.hypot(tower.x - this.x, tower.y - this.y);
            const angleToTower = Math.atan2(tower.y - this.y, tower.x - this.x);
            const angleDiff = Math.atan2(Math.sin(angleToTower - this.facingAngle), Math.cos(angleToTower - this.facingAngle));
            if (dist <= this.attackRange + tower.tw / 2 + 12 && Math.abs(angleDiff) < Math.PI * 0.61) {
                let dmg = this.classType === 'wizard' ? Math.floor(this.damage * 0.6) : this.damage;
                if (this.equipment.ring) dmg = Math.floor(dmg * this.equipment.ring.damageMult);
                let isCrit = false;
                if (this.classType === 'beast' && Math.random() < 0.2) { dmg *= 2; isCrit = true; }
                tower.takeDamage(dmg, isCrit);
            }
        });

        setTimeout(() => { this.isSwinging = false; }, 150);
    }

    castSpell() { /* replaced by fireProjectile */ }

    takeDamage(amount, killerName = null) {
        // Shield absorbs all damage; rare shield reflects it back
        if (this.shielding) {
            if (this.equipment.shield?.reflects) {
                enemies.forEach(e => {
                    if (Math.hypot(e.x - this.x, e.y - this.y) < 130) e.takeDamage(amount);
                });
                showFloatingText(this.x, this.y - 30, 'REFLECTED!', '#29b6f6');
            } else {
                showFloatingText(this.x, this.y - 20, 'BLOCKED!', '#29b6f6');
            }
            return;
        }
        // Armor reduces incoming damage
        if (this.equipment.armor) {
            amount = Math.ceil(amount * (1 - this.equipment.armor.damageReduction));
        }
        if (this.isBlocking) {
            amount = Math.floor(amount * (0.3 / this.abilityPower)); // Block mitigates damage
            showFloatingText(this.x, this.y - 20, "Block!", "#81C784");
        }
        
        this.hp -= amount;
        updateHUD();
        
        // Hit flash effect
        const originalColor = this.color;
        this.color = "#fff";
        setTimeout(() => this.color = originalColor, 100);

        if (this.hp <= 0) {
            gameOver(killerName);
        }
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
        showFloatingText(this.x, this.y - 30, `+${Math.floor(amount)}`, "#4CAF50");
        updateHUD();
    }

    gainXp(amount) {
        this.xp += amount;
        this.score += amount;
        if (this.xp >= this.xpToNext) {
            this.levelUp();
        }
        updateHUD();
    }

    levelUp() {
        this.level++;
        this.xp -= this.xpToNext;
        this.xpToNext = Math.floor(this.xpToNext * 1.75); // steeper curve: each level takes noticeably longer
        
        // Base stat increases on level
        this.maxHp += 10;
        this.hp = this.maxHp;
        this.damage += 2;
        
        triggerLevelUpScreen();
    }

    drawPlayer() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        const bob = this.vx !== 0 || this.vy !== 0 ? Math.sin(performance.now() / 100) * 2 : 0;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(drawX, drawY + this.size / 2, this.size / 1.5, this.size / 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shield active: blue protective aura
        if (this.shielding) {
            const pulse = 0.35 + Math.sin(Date.now() / 90) * 0.12;
            ctx.save();
            ctx.globalAlpha = pulse * 0.45;
            ctx.fillStyle = '#29b6f6';
            ctx.beginPath();
            ctx.arc(drawX, drawY, this.size * 1.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = '#29b6f6';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(drawX, drawY, this.size * 1.35, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        const bA = this.facingAngle + Math.PI / 2;
        const eOff = Math.cos(this.facingAngle) >= 0 ? 2 : -2;

        if (this.classType === 'knight') {
            // --- Legs ---
            ctx.fillStyle = '#546E7A';
            ctx.fillRect(drawX - 8, drawY + 8 + bob, 6, 8);
            ctx.fillRect(drawX + 2, drawY + 8 + bob, 6, 8);

            // --- Body armor ---
            ctx.fillStyle = '#78909C';
            ctx.fillRect(drawX - 10, drawY - 4 + bob, 20, 14);
            ctx.fillStyle = '#90A4AE';
            ctx.fillRect(drawX - 10, drawY - 4 + bob, 20, 5);
            ctx.fillStyle = '#607D8B'; // pauldrons
            ctx.fillRect(drawX - 14, drawY - 6 + bob, 6, 7);
            ctx.fillRect(drawX + 8, drawY - 6 + bob, 6, 7);

            // --- Helmet ---
            ctx.fillStyle = '#607D8B';
            ctx.fillRect(drawX - 9, drawY - 18 + bob, 18, 16);
            ctx.fillStyle = '#546E7A'; // top ridge
            ctx.fillRect(drawX - 4, drawY - 22 + bob, 8, 5);
            ctx.fillStyle = '#37474F'; // visor band
            ctx.fillRect(drawX - 9, drawY - 10 + bob, 18, 5);
            ctx.fillStyle = '#E3F2FD'; // eye slits
            ctx.fillRect(drawX + eOff - 7, drawY - 9 + bob, 5, 2);
            ctx.fillRect(drawX + eOff + 2, drawY - 9 + bob, 5, 2);
            ctx.fillStyle = '#455A64'; // nasal guard
            ctx.fillRect(drawX - 2, drawY - 18 + bob, 4, 13);

            // --- Sword ---
            ctx.save();
            ctx.translate(drawX, drawY + bob);
            let wRot;
            if (this.isSwinging) {
                const prog = Math.min(1, (performance.now() - this.lastAttackTime) / 150);
                wRot = bA + (-Math.PI / 3 + prog * 2 * Math.PI / 3);
            } else {
                wRot = bA - Math.PI / 6;
            }
            ctx.rotate(wRot);
            ctx.fillStyle = '#CFD8DC'; ctx.fillRect(-2, -this.size - 6, 4, this.size + 6);
            ctx.fillStyle = '#9E9E9E'; ctx.fillRect(-6, -this.size, 12, 3);
            ctx.fillStyle = '#795548'; ctx.fillRect(-2, -this.size + 3, 4, 8);
            if (this.isBlocking) {
                ctx.fillStyle = '#1565C0';
                ctx.beginPath(); ctx.arc(12, 0, 10, -Math.PI / 2, Math.PI / 2); ctx.fill();
                ctx.fillStyle = '#FFD700'; ctx.fillRect(10, -6, 2, 12);
            }
            ctx.restore();

        } else if (this.classType === 'wizard') {
            // --- Robe ---
            ctx.fillStyle = '#7B1FA2';
            ctx.beginPath();
            ctx.moveTo(drawX - 8, drawY - 2 + bob);
            ctx.lineTo(drawX - 13, drawY + 14 + bob);
            ctx.lineTo(drawX + 13, drawY + 14 + bob);
            ctx.lineTo(drawX + 8, drawY - 2 + bob);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#4A148C'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(drawX - 5, drawY + 2 + bob, 3, 3);
            ctx.fillRect(drawX + 3, drawY + 7 + bob, 3, 3);

            // --- Head ---
            ctx.fillStyle = '#FFE0B2';
            ctx.beginPath(); ctx.arc(drawX, drawY - 8 + bob, 8, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#BCAAA4'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = '#1A237E';
            ctx.fillRect(drawX + eOff - 5, drawY - 9 + bob, 3, 3);
            ctx.fillRect(drawX + eOff + 2, drawY - 9 + bob, 3, 3);
            ctx.fillStyle = '#E0E0E0'; // beard
            ctx.fillRect(drawX - 4, drawY - 3 + bob, 8, 3);

            // --- Hat ---
            ctx.fillStyle = '#6A1B9A';
            ctx.fillRect(drawX - 9, drawY - 16 + bob, 18, 4);
            ctx.beginPath();
            ctx.moveTo(drawX - 7, drawY - 16 + bob);
            ctx.lineTo(drawX, drawY - 28 + bob);
            ctx.lineTo(drawX + 7, drawY - 16 + bob);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(drawX - 9, drawY - 19 + bob, 18, 3);
            ctx.fillRect(drawX - 2, drawY - 25 + bob, 4, 2);
            ctx.fillRect(drawX, drawY - 27 + bob, 2, 5);

            // --- Staff ---
            ctx.save();
            ctx.translate(drawX, drawY + bob);
            let sRot;
            if (this.isSwinging) {
                const prog = Math.min(1, (performance.now() - this.lastAttackTime) / 150);
                sRot = bA + (-Math.PI / 3 + prog * 2 * Math.PI / 3);
            } else {
                sRot = bA - Math.PI / 8;
            }
            ctx.rotate(sRot);
            ctx.fillStyle = '#795548'; ctx.fillRect(-1.5, -this.size - 6, 3, this.size + 6);
            const swinging = this.isSwinging;
            ctx.fillStyle = swinging ? '#E0F7FA' : '#00BCD4';
            ctx.beginPath(); ctx.arc(0, -this.size - 7, swinging ? 7 : 4, 0, Math.PI * 2); ctx.fill();
            if (swinging) {
                ctx.strokeStyle = 'rgba(0,229,255,0.9)'; ctx.lineWidth = 3; ctx.stroke();
            }
            ctx.restore();

        } else { // beast
            // --- Body ---
            ctx.fillStyle = '#FFCC80';
            ctx.strokeStyle = '#E65100'; ctx.lineWidth = 2;
            ctx.fillRect(drawX - 11, drawY - 2 + bob, 22, 16);
            ctx.strokeRect(drawX - 11, drawY - 2 + bob, 22, 16);
            ctx.fillStyle = '#FF8F00';
            ctx.fillRect(drawX - 6, drawY + bob, 3, 12);
            ctx.fillRect(drawX + 3, drawY + bob, 3, 12);

            // --- Legs ---
            ctx.fillStyle = '#EF6C00';
            ctx.fillRect(drawX - 9, drawY + 12 + bob, 7, 6);
            ctx.fillRect(drawX + 2, drawY + 12 + bob, 7, 6);
            ctx.fillStyle = '#FFF8E1';
            ctx.fillRect(drawX - 11, drawY + 17 + bob, 3, 3); ctx.fillRect(drawX - 7, drawY + 17 + bob, 3, 3);
            ctx.fillRect(drawX + 5, drawY + 17 + bob, 3, 3); ctx.fillRect(drawX + 9, drawY + 17 + bob, 3, 3);

            // --- Head ---
            ctx.fillStyle = '#FFCC80';
            ctx.strokeStyle = '#E65100'; ctx.lineWidth = 2;
            ctx.fillRect(drawX - 12, drawY - 18 + bob, 24, 18);
            ctx.strokeRect(drawX - 12, drawY - 18 + bob, 24, 18);

            // Ears
            ctx.fillStyle = '#EF6C00';
            ctx.beginPath(); ctx.moveTo(drawX - 12, drawY - 18 + bob); ctx.lineTo(drawX - 17, drawY - 27 + bob); ctx.lineTo(drawX - 4, drawY - 18 + bob); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(drawX + 4, drawY - 18 + bob); ctx.lineTo(drawX + 17, drawY - 27 + bob); ctx.lineTo(drawX + 12, drawY - 18 + bob); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#FF8A65';
            ctx.beginPath(); ctx.moveTo(drawX - 11, drawY - 18 + bob); ctx.lineTo(drawX - 14, drawY - 24 + bob); ctx.lineTo(drawX - 5, drawY - 18 + bob); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(drawX + 5, drawY - 18 + bob); ctx.lineTo(drawX + 14, drawY - 24 + bob); ctx.lineTo(drawX + 11, drawY - 18 + bob); ctx.closePath(); ctx.fill();

            // Snout
            ctx.fillStyle = '#FFAB40'; ctx.fillRect(drawX - 7, drawY - 9 + bob, 14, 7);
            ctx.fillStyle = '#4E342E'; ctx.fillRect(drawX - 3, drawY - 9 + bob, 6, 4);
            ctx.fillStyle = '#FFF';
            ctx.fillRect(drawX - 5, drawY - 3 + bob, 3, 3); ctx.fillRect(drawX - 1, drawY - 3 + bob, 3, 3); ctx.fillRect(drawX + 3, drawY - 3 + bob, 3, 3);

            // Eyes
            ctx.fillStyle = '#FF6F00';
            ctx.fillRect(drawX + eOff - 10, drawY - 16 + bob, 7, 5);
            ctx.fillRect(drawX + eOff + 3, drawY - 16 + bob, 7, 5);
            ctx.fillStyle = '#212121';
            ctx.fillRect(drawX + eOff - 7, drawY - 15 + bob, 2, 4);
            ctx.fillRect(drawX + eOff + 6, drawY - 15 + bob, 2, 4);

            // --- Claws ---
            ctx.save();
            ctx.translate(drawX, drawY + bob);
            let cRot;
            if (this.isSwinging) {
                const prog = Math.min(1, (performance.now() - this.lastAttackTime) / 150);
                cRot = bA + (-Math.PI / 3 + prog * 2 * Math.PI / 3);
            } else {
                cRot = bA - Math.PI / 6;
            }
            ctx.rotate(cRot);
            ctx.fillStyle = '#FFF8E1';
            ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(8, -20); ctx.lineTo(13, -14); ctx.fill();
            ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(14, -18); ctx.lineTo(17, -12); ctx.fill();
            ctx.restore();
        }
    }
}

let enemies = [];
let projectiles = [];
let particles = [];
let floatTexts = [];
let items = [];
let ammoSpawnTimer = 5;
let chests = [];
let archerTowers = [];
const spawnedTowerKeys = new Set();

// ── Equipment & Chest Data ──────────────────────────────────────────────────
const ARMOR_ITEMS = [
    { name: 'Leather Armor', rarity: 'common',   color: '#9e9e9e', damageReduction: 0.10, slot: 'armor' },
    { name: 'Chain Mail',    rarity: 'uncommon', color: '#4caf50', damageReduction: 0.22, slot: 'armor' },
    { name: 'Plate Armor',   rarity: 'rare',     color: '#5c9be8', damageReduction: 0.38, slot: 'armor' },
];
const RING_ITEMS = [
    { name: 'Iron Ring',     rarity: 'common',   color: '#9e9e9e', damageMult: 1.12, slot: 'ring' },
    { name: 'Silver Ring',   rarity: 'uncommon', color: '#4caf50', damageMult: 1.25, slot: 'ring' },
    { name: 'Gemstone Ring', rarity: 'rare',     color: '#5c9be8', damageMult: 1.40, slot: 'ring' },
];
const SHIELD_ITEMS = [
    { name: 'Wooden Shield', rarity: 'common',   color: '#9e9e9e', blockDuration: 1.0, cooldown: 14, reflects: false, slot: 'shield' },
    { name: 'Iron Shield',   rarity: 'uncommon', color: '#4caf50', blockDuration: 1.2, cooldown: 10, reflects: false, slot: 'shield' },
    { name: 'Runic Shield',  rarity: 'rare',     color: '#5c9be8', blockDuration: 1.5, cooldown:  7, reflects: true,  slot: 'shield' },
];
// Chest positions: inner ring = common, mid = uncommon, outer = rare
const CHEST_SPAWN_DATA = [
    { x:  550, y:    0, loot: ARMOR_ITEMS[0] }, { x:    0, y: -550, loot: RING_ITEMS[0]  },
    { x: 1000, y:  900, loot: ARMOR_ITEMS[1] }, { x: -900, y: 1000, loot: RING_ITEMS[1]  },
    { x: 1600, y:    0, loot: ARMOR_ITEMS[2] }, { x:    0, y: 1600, loot: RING_ITEMS[2]  },
    { x: -350, y:  350, loot: SHIELD_ITEMS[0] },
    { x: -950, y: -500, loot: SHIELD_ITEMS[1] },
    { x:  700, y:-1400, loot: SHIELD_ITEMS[2] },
];

class Enemy extends Entity {
    constructor(x, y, type) {
        super(x, y, type.size, type.color);
        this.typeId = type.id;
        this.name = type.name;
        
        // Scale stats with current player level — gentle at low levels, ramps up later
        const multiplier = 1 + (Math.max(0, player.level - 2) * 0.1);
        
        this.maxHp = Math.floor(type.hp * multiplier);
        this.hp = this.maxHp;
        this.damage = Math.floor(type.dmg * multiplier);
        // Early levels: mobs move slower, reaching full speed around level 6
        const earlyLevelSpeedMult = Math.min(1.0, 0.42 + player.level * 0.11);
        this.speed = type.speed * (0.8 + Math.random() * 0.4) * earlyLevelSpeedMult;
        this.baseSpeed = this.speed;
        this.xpValue = Math.floor(type.xp * multiplier);
        this.behavior = type.behavior;
        this.range = type.range || 0;
        this.isBoss = type.isBoss || false;
        
        this.lastAttackTime = 0; // used by ranged enemies
        
        // Aggro range: at low levels enemies only chase when the player gets close;
        // once aggroed (or after taking damage) they stay aggressive.
        this.aggroed = false;
        this.aggroRange = player.level < 6 ? 200 + player.level * 42 : Infinity;
        
        // Melee attack state machine
        this.attackState = 'approach';     // approach | windup | strike | recoil
        this.attackStateTimer = 0.4 + Math.random() * 0.8; // stagger so mobs don't all attack simultaneously
        this.strikeHit = false;
        this.meleeRange = this.size / 2 + 26; // stop-and-attack distance (doesn't overlap player)
        this.stunTimer = 0; // seconds remaining in hit-stun
        this.knockbackVx = 0;
        this.knockbackVy = 0;
        
        // Movement offset for organic weaving
        this.angleOffset = Math.random() * Math.PI * 2;
    }

    update(dt) {
        // Separation: push away from overlapping enemies (stronger force to prevent stacking)
        for (const other of enemies) {
            if (other === this) continue;
            const sx = this.x - other.x;
            const sy = this.y - other.y;
            const sd = Math.hypot(sx, sy);
            const minSep = (this.size + other.size) * 0.95;
            if (sd < minSep && sd > 0) {
                const push = (minSep - sd) * 0.55;
                this.x += (sx / sd) * push;
                this.y += (sy / sd) * push;
            }
        }

        // Shield repulsion: hard barrier — push enemies outside the shield bubble
        if (player.shielding) {
            const shieldRadius = player.size * 1.4 + this.size * 0.6;
            const pdx = this.x - player.x;
            const pdy = this.y - player.y;
            const pd = Math.hypot(pdx, pdy);
            if (pd < shieldRadius && pd > 0) {
                const push = (shieldRadius - pd) * 1.0;
                this.x += (pdx / pd) * push;
                this.y += (pdy / pd) * push;
            } else if (pd === 0) {
                // Exactly on top — eject in a random direction
                this.x += (Math.random() - 0.5) * shieldRadius * 2;
                this.y += (Math.random() - 0.5) * shieldRadius * 2;
            }
        }

        const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);

        // ── Knockback velocity: decays exponentially, applied before all other movement ──
        if (this.knockbackVx !== 0 || this.knockbackVy !== 0) {
            this.x += this.knockbackVx * dt;
            this.y += this.knockbackVy * dt;
            const decay = Math.exp(-9 * dt);
            this.knockbackVx *= decay;
            this.knockbackVy *= decay;
            if (Math.abs(this.knockbackVx) < 1 && Math.abs(this.knockbackVy) < 1) {
                this.knockbackVx = 0;
                this.knockbackVy = 0;
            }
        }

        // ── Ranged enemies: keep distance and fire projectiles ───────────────
        if (this.behavior === 'ranged') {
            this.speed = this.baseSpeed;
            let moveAngle = angleToPlayer;
            if (distToPlayer < this.range * 0.65) {
                moveAngle = angleToPlayer + Math.PI; // retreat when too close
            } else if (distToPlayer <= this.range) {
                this.speed = 0;
                if (performance.now() - this.lastAttackTime > 2100) {
                    projectiles.push(new Projectile(this.x, this.y, angleToPlayer, false, this.damage, 'fireball', this.name));
                    this.lastAttackTime = performance.now();
                }
                return;
            }
            this.x += Math.cos(moveAngle) * this.speed * dt;
            this.y += Math.sin(moveAngle) * this.speed * dt;
            return;
        }

        // ── Hit-stun: freeze attack machine when recently damaged ─────────────
        if (this.stunTimer > 0) {
            this.stunTimer -= dt;
            return;
        }

        // ── Melee state machine ──────────────────────────────────────────────
        this.attackStateTimer -= dt;

        switch (this.attackState) {
            case 'approach': {
                // At low levels, enemies wander until the player comes close (aggro range)
                if (!this.aggroed && distToPlayer > this.aggroRange) {
                    this.angleOffset += dt * 0.9;
                    this.x += Math.cos(this.angleOffset) * this.speed * 0.25 * dt;
                    this.y += Math.sin(this.angleOffset) * this.speed * 0.25 * dt;
                    break;
                }
                this.aggroed = true;
                // Enter windup when in range and inter-attack cooldown has elapsed
                if (distToPlayer <= this.meleeRange && this.attackStateTimer <= 0) {
                    this.attackState = 'windup';
                    this.attackStateTimer = 0.28;
                } else {
                    // Move toward player with behavior-specific weaving; slow near attack range
                    let moveAngle = angleToPlayer;
                    if (this.behavior === 'erratic') {
                        this.angleOffset += (Math.random() - 0.5) * dt * 10;
                        moveAngle += Math.sin(this.angleOffset) * 1.8;
                    } else if (this.behavior === 'flank') {
                        this.angleOffset += dt * 0.55;
                        const sideDir = Math.sin(this.angleOffset) >= 0 ? 1 : -1;
                        moveAngle = angleToPlayer + (Math.PI / 3) * sideDir;
                    } else { // chase
                        this.angleOffset += (Math.random() - 0.5) * dt * 3;
                        moveAngle += Math.sin(this.angleOffset) * 0.25;
                    }
                    // Decelerate near attack range so the enemy doesn't overshoot into the player
                    const brakeDist = this.meleeRange * 1.6;
                    const speedMult = distToPlayer < brakeDist
                        ? 0.35 + 0.65 * (distToPlayer / brakeDist)
                        : 1.0;
                    this.x += Math.cos(moveAngle) * this.speed * speedMult * dt;
                    this.y += Math.sin(moveAngle) * this.speed * speedMult * dt;
                }
                break;
            }
            case 'windup': {
                // Pause and telegraph — enemy glows red in draw()
                if (this.attackStateTimer <= 0) {
                    this.attackState = 'strike';
                    this.attackStateTimer = 0.13;
                    this.strikeHit = false;
                }
                break;
            }
            case 'strike': {
                // Fast lunge toward player
                this.x += Math.cos(angleToPlayer) * this.speed * 3.2 * dt;
                this.y += Math.sin(angleToPlayer) * this.speed * 3.2 * dt;
                // Damage applied once when the lunge reaches the player
                if (!this.strikeHit && distToPlayer < this.meleeRange + 14) {
                    player.takeDamage(this.damage, this.name);
                    this.strikeHit = true;
                }
                if (this.attackStateTimer <= 0) {
                    this.attackState = 'recoil';
                    this.attackStateTimer = 0.36;
                    // Pop backward immediately so enemy doesn't stay inside player
                    this.x -= Math.cos(angleToPlayer) * 28;
                    this.y -= Math.sin(angleToPlayer) * 28;
                }
                break;
            }
            case 'recoil': {
                // Drift away from player before re-engaging
                this.x += Math.cos(angleToPlayer + Math.PI) * this.speed * 0.65 * dt;
                this.y += Math.sin(angleToPlayer + Math.PI) * this.speed * 0.65 * dt;
                if (this.attackStateTimer <= 0) {
                    this.attackState = 'approach';
                    // At low levels enemies hesitate longer between attacks
                    const lowLevelPause = Math.max(0, (6 - player.level) * 0.13);
                    this.attackStateTimer = 0.4 + lowLevelPause; // cooldown before next windup triggers
                }
                break;
            }
        }
    }

    takeDamage(amount, isCrit = false) {
        this.hp -= amount;
        showFloatingText(this.x, this.y, Math.floor(amount), isCrit ? "yellow" : "white", isCrit);
        
        // Hit-stun: interrupt windup/strike, force a brief pause
        this.aggroed = true; // being hit always wakes the enemy up
        this.stunTimer = 0.32;
        if (this.attackState === 'windup' || this.attackState === 'strike') {
            this.attackState = 'recoil';
            this.attackStateTimer = 0.36;
            this.strikeHit = false;
        }

        // Knockback: weaker enemies (lower maxHp) fly back further
        const kbPower = 1200 / Math.sqrt(this.maxHp);
        const kbDx = this.x - player.x;
        const kbDy = this.y - player.y;
        const kbDist = Math.hypot(kbDx, kbDy) || 1;
        this.knockbackVx = (kbDx / kbDist) * kbPower;
        this.knockbackVy = (kbDy / kbDist) * kbPower;

        // Create hit particles
        createParticles(this.x, this.y, this.color, 3);

        if (this.hp <= 0) {
            player.gainXp(this.xpValue);
            player.kills++;
            if (this.isBoss) {
                showFloatingText(this.x, this.y - 20, "BOSS DEFEATED!", "gold");
                player.heal(player.maxHp * 0.5);
            } else if (Math.random() < 0.09) {
                // ~9% chance to drop a health orb
                items.push({
                    x: this.x, y: this.y,
                    size: 10,
                    heal: Math.max(10, Math.floor(player.maxHp * 0.15)),
                    life: 12,
                    bob: Math.random() * Math.PI * 2
                });
            }
            createParticles(this.x, this.y, this.color, 10);
            return true; // is dead
        }
        return false;
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        const s = this.size;

        // Windup telegraph: subtle orange tint so the player can read the attack
        if (this.attackState === 'windup') {
            ctx.save();
            ctx.globalAlpha = 0.25 + Math.sin(Date.now() / 80) * 0.1;
            ctx.fillStyle = '#ff6d00';
            ctx.beginPath();
            ctx.arc(drawX, drawY, s * 1.15, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Health bar
        ctx.fillStyle = 'red';
        ctx.fillRect(drawX - s/2, drawY - s/2 - 8, s, 4);
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(drawX - s/2, drawY - s/2 - 8, s * (this.hp / this.maxHp), 4);

        ctx.fillStyle = this.color;
        switch (this.typeId) {
            case 'wisp': {
                const pulse = 0.5 + Math.sin(Date.now() / 250) * 0.3;
                ctx.globalAlpha = pulse * 0.35;
                ctx.beginPath(); ctx.arc(drawX, drawY, s * 1.6, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = pulse;
                ctx.beginPath(); ctx.arc(drawX, drawY, s, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
                break;
            }
            case 'rat': {
                ctx.beginPath(); ctx.ellipse(drawX, drawY, s/2, s/3, 0, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = this.color; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(drawX - s/2, drawY);
                ctx.quadraticCurveTo(drawX - s*0.9, drawY - s/3, drawX - s, drawY + s/4); ctx.stroke();
                break;
            }
            case 'bat':
            case 'harpy': {
                ctx.beginPath();
                ctx.moveTo(drawX, drawY - s/2); ctx.lineTo(drawX + s/2, drawY + s/2); ctx.lineTo(drawX - s/2, drawY + s/2); ctx.fill();
                ctx.globalAlpha = 0.45;
                ctx.beginPath(); ctx.ellipse(drawX - s*0.9, drawY, s, s/3, -0.4, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(drawX + s*0.9, drawY, s, s/3,  0.4, 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1;
                break;
            }
            case 'mushroom': {
                ctx.fillStyle = '#827717';
                ctx.fillRect(drawX - s/5, drawY - s/4, s*0.4, s/2);
                ctx.fillStyle = this.color;
                ctx.beginPath(); ctx.arc(drawX, drawY - s/4, s/2, Math.PI, 0); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.45)';
                ctx.beginPath(); ctx.arc(drawX - s/5, drawY - s/3,  s/7, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(drawX + s/4, drawY - s/4,  s/9, 0, Math.PI*2); ctx.fill();
                break;
            }
            case 'slime': {
                ctx.beginPath(); ctx.arc(drawX, drawY + s/4, s/2, Math.PI, 0); ctx.fill();
                ctx.globalAlpha = 0.5;
                ctx.beginPath(); ctx.arc(drawX - s/4, drawY + s/8, s/5, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(drawX + s/4, drawY + s/6, s/7, 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1;
                break;
            }
            case 'wolfkin': {
                ctx.beginPath();
                ctx.moveTo(drawX, drawY - s/2); ctx.lineTo(drawX + s/2, drawY); ctx.lineTo(drawX, drawY + s*0.65); ctx.lineTo(drawX - s/2, drawY); ctx.fill();
                ctx.beginPath();
                ctx.moveTo(drawX - s/5, drawY - s/2); ctx.lineTo(drawX - s/2, drawY - s); ctx.lineTo(drawX + s/6, drawY - s/2); ctx.fill();
                break;
            }
            case 'wraith': {
                ctx.globalAlpha = 0.75;
                ctx.beginPath(); ctx.moveTo(drawX, drawY - s/2); ctx.lineTo(drawX + s/2, drawY + s/2); ctx.lineTo(drawX - s/2, drawY + s/2); ctx.fill();
                ctx.globalAlpha = 0.3;
                ctx.beginPath(); ctx.arc(drawX, drawY + s/3, s/2, 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1;
                break;
            }
            case 'goblin': {
                ctx.fillRect(drawX - s/2, drawY - s/2, s, s);
                ctx.beginPath(); ctx.moveTo(drawX - s/2, drawY - s/3); ctx.lineTo(drawX - s, drawY - s*0.85); ctx.lineTo(drawX - s/5, drawY - s/2); ctx.fill();
                ctx.beginPath(); ctx.moveTo(drawX + s/2, drawY - s/3); ctx.lineTo(drawX + s, drawY - s*0.85); ctx.lineTo(drawX + s/5, drawY - s/2); ctx.fill();
                break;
            }
            case 'skeleton': {
                ctx.fillRect(drawX - s/2, drawY - s/2, s, s);
                ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
                for (let r = 0; r < 3; r++) {
                    ctx.beginPath(); ctx.moveTo(drawX - s/2 + 2, drawY - s/3 + r*s/3.5);
                    ctx.lineTo(drawX + s/2 - 2, drawY - s/3 + r*s/3.5); ctx.stroke();
                }
                break;
            }
            case 'troll': {
                ctx.fillRect(drawX - s/2, drawY - s/2, s, s);
                ctx.beginPath(); ctx.arc(drawX, drawY - s/2, s/3, Math.PI, 0); ctx.fill();
                break;
            }
            case 'golem': {
                ctx.beginPath();
                ctx.moveTo(drawX, drawY - s/2); ctx.lineTo(drawX + s/2, drawY - s/4); ctx.lineTo(drawX + s/2, drawY + s/4);
                ctx.lineTo(drawX, drawY + s/2); ctx.lineTo(drawX - s/2, drawY + s/4); ctx.lineTo(drawX - s/2, drawY - s/4);
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(drawX - s/3, drawY - s/4); ctx.lineTo(drawX + s/3, drawY + s/3); ctx.stroke();
                break;
            }
            case 'minotaur': {
                ctx.fillRect(drawX - s/2, drawY - s/2, s, s);
                ctx.beginPath(); ctx.moveTo(drawX - s/2, drawY - s/2); ctx.lineTo(drawX - s*0.9, drawY - s*1.15); ctx.lineTo(drawX - s/5, drawY - s/2); ctx.fill();
                ctx.beginPath(); ctx.moveTo(drawX + s/2, drawY - s/2); ctx.lineTo(drawX + s*0.9, drawY - s*1.15); ctx.lineTo(drawX + s/5, drawY - s/2); ctx.fill();
                break;
            }
            case 'medusa': {
                ctx.beginPath(); ctx.arc(drawX, drawY, s/2, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = this.color; ctx.lineWidth = 2;
                for (let i = 0; i < 6; i++) {
                    const a = (i/6) * Math.PI * 2 + Date.now()/1200;
                    ctx.beginPath(); ctx.moveTo(drawX + Math.cos(a)*s/2, drawY + Math.sin(a)*s/2);
                    ctx.lineTo(drawX + Math.cos(a)*s*1.1, drawY + Math.sin(a)*s*1.1); ctx.stroke();
                }
                break;
            }
            case 'hydra': {
                ctx.beginPath(); ctx.arc(drawX, drawY + s/4, s*0.55, 0, Math.PI*2); ctx.fill();
                [-0.8, -0.25, 0.25, 0.8].forEach(a => {
                    ctx.beginPath(); ctx.arc(drawX + Math.sin(a)*s*0.8, drawY - s/3, s/4, 0, Math.PI*2); ctx.fill();
                });
                break;
            }
            case 'dragon': {
                ctx.fillRect(drawX - s/2, drawY - s/2, s, s);
                ctx.globalAlpha = 0.55;
                ctx.beginPath(); ctx.moveTo(drawX - s/3, drawY); ctx.lineTo(drawX - s*2.2, drawY - s); ctx.lineTo(drawX - s, drawY + s/2); ctx.fill();
                ctx.beginPath(); ctx.moveTo(drawX + s/3, drawY); ctx.lineTo(drawX + s*2.2, drawY - s); ctx.lineTo(drawX + s, drawY + s/2); ctx.fill();
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#FFC107';
                ctx.beginPath(); ctx.moveTo(drawX - s/3, drawY - s/2); ctx.lineTo(drawX - s/2, drawY - s*1.3); ctx.lineTo(drawX - s/8, drawY - s/2); ctx.fill();
                ctx.beginPath(); ctx.moveTo(drawX + s/3, drawY - s/2); ctx.lineTo(drawX + s/2, drawY - s*1.3); ctx.lineTo(drawX + s/8, drawY - s/2); ctx.fill();
                break;
            }
            case 'lich': {
                ctx.beginPath(); ctx.arc(drawX, drawY + s/4, s/2, 0, Math.PI); ctx.fill();
                ctx.beginPath(); ctx.moveTo(drawX - s/2, drawY); ctx.lineTo(drawX + s/2, drawY); ctx.lineTo(drawX, drawY - s*0.8); ctx.fill();
                ctx.fillStyle = '#E040FB';
                ctx.globalAlpha = 0.75 + Math.sin(Date.now()/180) * 0.25;
                ctx.beginPath(); ctx.arc(drawX, drawY - s*0.25, s/5, 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1;
                break;
            }
            default: {
                ctx.fillRect(drawX - s/2, drawY - s/2, s, s);
                if (this.isBoss) {
                    ctx.fillStyle = '#FFC107';
                    ctx.beginPath(); ctx.moveTo(drawX - s/2, drawY - s/2); ctx.lineTo(drawX - s/2 - 10, drawY - s); ctx.lineTo(drawX - s/4, drawY - s/2); ctx.fill();
                }
            }
        }
    }
}

class Projectile {
    constructor(x, y, angle, isPlayer, damage, type = 'fireball', shooterName = null) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.isPlayer = isPlayer;
        this.damage = damage;
        this.type = type;
        this.shooterName = shooterName;
        this.speed  = type === 'arrow' ? 520 : (type === 'rock' ? 320 : 400);
        this.size   = type === 'arrow' ? 5   : (type === 'rock' ? 9   : 6);
        this.color  = !isPlayer ? '#FF5722' : (type === 'arrow' ? '#FFD700' : (type === 'rock' ? '#A1887F' : '#00BCD4'));
        this.life   = type === 'rock' ? 1.0 : 1.5;
    }

    update(dt) {
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;
        this.life -= dt;

        // Collision
        if (this.isPlayer) {
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                if (Math.hypot(enemy.x - this.x, enemy.y - this.y) < enemy.size/2 + this.size) {
                    enemy.takeDamage(this.damage);
                    createParticles(this.x, this.y, this.color, 5);
                    return true; // destroy projectile
                }
            }
            // Also check Archer Towers
            for (let i = 0; i < archerTowers.length; i++) {
                const tower = archerTowers[i];
                if (Math.hypot(tower.x - this.x, tower.y - this.y) < tower.tw / 2 + this.size + 6) {
                    tower.takeDamage(this.damage);
                    createParticles(this.x, this.y, this.color, 5);
                    return true;
                }
            }
        } else {
            if (Math.hypot(player.x - this.x, player.y - this.y) < player.size/2 + this.size) {
                player.takeDamage(this.damage, this.shooterName);
                createParticles(this.x, this.y, this.color, 5);
                return true;
            }
        }
        return this.life <= 0;
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        if (this.type === 'arrow') {
            ctx.save();
            ctx.translate(drawX, drawY);
            ctx.rotate(this.angle);
            ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(7, 0); ctx.stroke();
            ctx.fillStyle = '#FFD700';
            ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(5, -3); ctx.lineTo(5, 3); ctx.fill();
            ctx.restore();
        } else if (this.type === 'rock') {
            ctx.fillStyle = '#8D6E63';
            ctx.beginPath(); ctx.arc(drawX, drawY, this.size, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#BCAAA4';
            ctx.beginPath(); ctx.arc(drawX - 2, drawY - 3, this.size * 0.4, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = this.color;
            ctx.beginPath(); ctx.arc(drawX, drawY, this.size, 0, Math.PI * 2); ctx.fill();
            if (this.isPlayer) {
                ctx.globalAlpha = 0.35;
                ctx.beginPath(); ctx.arc(drawX, drawY, this.size * 2, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
    }
}

// ── Archer Tower — stationary mob that fires arrows and drops a chest on death ──
class ArcherTower {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.tw = 26;          // visual width
        this.th = 50;          // visual height
        this.maxHp = 180 + player.level * 22;
        this.hp = this.maxHp;
        this.lastShotTime = 0;
        this.shotCooldown = 2800;  // ms between shots
        this.range = 320;
        this.damage = 10 + player.level * 2;
        this.dead = false;
        this.name = 'Archer Tower';
        this.shootAnim = 0; // counts down in seconds; >0 = drawing bow
    }

    update(dt) {
        if (this.shootAnim > 0) this.shootAnim -= dt;
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist <= this.range && performance.now() - this.lastShotTime >= this.shotCooldown) {
            // Aim from ground-level world position so angle is correct for collision
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            projectiles.push(new Projectile(this.x, this.y, angle, false, this.damage, 'arrow', this.name));
            this.lastShotTime = performance.now();
            this.shootAnim = 0.45;
        }
    }

    takeDamage(amount, isCrit = false) {
        this.hp -= amount;
        showFloatingText(this.x, this.y - this.th - 12, Math.floor(amount), isCrit ? 'yellow' : 'white', isCrit);
        createParticles(this.x, this.y - this.th * 0.5, '#795548', 3);
        if (this.hp <= 0) {
            this.dead = true;
            player.gainXp(90 + player.level * 5);
            // Drop a chest with a random equipment item
            const allItems = [...ARMOR_ITEMS, ...RING_ITEMS, ...SHIELD_ITEMS];
            const loot = allItems[Math.floor(Math.random() * allItems.length)];
            chests.push({ x: this.x, y: this.y + 8, opened: false, loot });
            showFloatingText(this.x, this.y - this.th - 34, 'Tower Destroyed!', '#FFD700');
            createParticles(this.x, this.y - this.th * 0.5, '#5D4037', 20);
            return true;
        }
        return false;
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        const tw = this.tw;
        const th = this.th;

        // Ground shadow
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(drawX, drawY + 5, tw * 0.95, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── Tower body — thin stone rectangle ──────────────────────────────
        ctx.fillStyle = '#455A64';
        ctx.fillRect(drawX - tw / 2, drawY - th, tw, th);

        // Stone block rows with mortar lines
        const rows = 6;
        const rowH = th / rows;
        for (let r = 0; r < rows; r++) {
            ctx.fillStyle = '#37474F';
            ctx.fillRect(drawX - tw / 2, drawY - th + r * rowH, tw, 1.5);
            ctx.fillStyle = '#546E7A';
            const bOff = (r % 2 === 0) ? 1 : tw * 0.3;
            ctx.fillRect(drawX - tw / 2 + bOff, drawY - th + r * rowH + 2, tw * 0.4, rowH - 3.5);
        }

        // Right-edge shadow (depth)
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(drawX + tw / 2 - 4, drawY - th, 4, th);

        // Arrow slit (embrasure) — near top of tower
        const slitY = drawY - th * 0.72;
        ctx.fillStyle = '#1C2833';
        ctx.fillRect(drawX - 3, slitY, 6, 10);
        // When firing, show an arrow tip peeking out the window
        if (this.shootAnim > 0) {
            ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(drawX - 3, slitY + 5);
            ctx.lineTo(drawX + 10, slitY + 5);
            ctx.stroke();
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(drawX + 11, slitY + 5);
            ctx.lineTo(drawX + 8, slitY + 3);
            ctx.lineTo(drawX + 8, slitY + 7);
            ctx.fill();
        }

        // Lower arrow slit
        ctx.fillStyle = '#1C2833';
        ctx.fillRect(drawX - 2, drawY - th * 0.38, 4, 8);

        // Parapet ledge
        ctx.fillStyle = '#37474F';
        ctx.fillRect(drawX - tw / 2 - 3, drawY - th - 1, tw + 6, 4);

        // Merlons (crenels)
        const mw = 7, mh = 9;
        ctx.fillStyle = '#37474F';
        ctx.fillRect(drawX - tw / 2 - 3, drawY - th - 1 - mh, mw, mh);
        ctx.fillRect(drawX + tw / 2 - mw + 3, drawY - th - 1 - mh, mw, mh);
        ctx.fillRect(drawX - 2, drawY - th - 1 - mh + 4, 4, mh - 4);

        // ── Health bar ──────────────────────────────────────────────────────
        const barW = 40;
        const barY = drawY - th - mh - 14;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(drawX - barW / 2, barY, barW, 5);
        const hpPct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = hpPct > 0.5 ? '#4CAF50' : (hpPct > 0.25 ? '#FFC107' : '#F44336');
        ctx.fillRect(drawX - barW / 2, barY, barW * hpPct, 5);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 0.5;
        ctx.strokeRect(drawX - barW / 2, barY, barW, 5);

        // Label
        ctx.fillStyle = '#90A4AE';
        ctx.font = '8px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('ARCHER TOWER', drawX, barY - 2);
        ctx.textAlign = 'left';
    }
}

// Visual effects
function createParticles(x, y, color, count) {
    for(let i=0; i<count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200,
            life: Math.random() * 0.5 + 0.2,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
}

function showFloatingText(x, y, text, color = "white", isCrit = false) {
    floatTexts.push({
        x: x, y: y, text: text, color: color,
        life: 1, maxLife: 1, isCrit: isCrit
    });
}

// Helpers
function findNearestEnemy(source, maxDist) {
    let nearest = null;
    let minDist = maxDist;
    for (const enemy of enemies) {
        const dist = Math.hypot(enemy.x - source.x, enemy.y - source.y);
        if (dist < minDist) {
            minDist = dist;
            nearest = { enemy, distance: dist };
        }
    }
    return nearest;
}

function applyTerrainCollision(entity) {
    const R = WorldGen.TREE_RADIUS;
    const trees = WorldGen.getTreesInRect(entity.x, entity.y, R + entity.size + 12, R + entity.size + 12);
    for (const tree of trees) {
        const d = Math.hypot(entity.x - tree.x, entity.y - tree.y);
        const minD = entity.size / 2 + R;
        if (d < minD && d > 0) {
            const push = minD - d;
            entity.x += (entity.x - tree.x) / d * push;
            entity.y += (entity.y - tree.y) / d * push;
        }
    }
    const buildings = WorldGen.getBuildingsNear(entity.x, entity.y, 350);
    for (const b of buildings) {
        const left = b.wx - b.w/2 - 5, right  = b.wx + b.w/2 + 5;
        const top  = b.wy - b.h/2 - 5, bottom = b.wy + b.h/2 + 5;
        const hs = entity.size / 2;
        if (entity.x + hs > left && entity.x - hs < right && entity.y + hs > top && entity.y - hs < bottom) {
            const oL = entity.x + hs - left,   oR = right  - (entity.x - hs);
            const oT = entity.y + hs - top,    oB = bottom - (entity.y - hs);
            const m = Math.min(oL, oR, oT, oB);
            if      (m === oL) entity.x -= oL;
            else if (m === oR) entity.x += oR;
            else if (m === oT) entity.y -= oT;
            else               entity.y += oB;
        }
    }
}

function drawTerrain() {
    const cx = camera.x + canvas.width  / 2;
    const cy = camera.y + canvas.height / 2;
    const hw = canvas.width  / 2 + 120;
    const hh = canvas.height / 2 + 120;

    // Buildings (drawn under trees)
    const buildings = WorldGen.getBuildingsNear(cx, cy, Math.max(canvas.width, canvas.height));
    buildings.forEach(b => {
        const dx = b.wx - camera.x - b.w / 2;
        const dy = b.wy - camera.y - b.h / 2;
        if (dx > canvas.width + 250 || dx + b.w < -250 || dy > canvas.height + 250 || dy + b.h < -250) return;
        if (b.type === 'fort') {
            // Outer walls
            ctx.fillStyle = '#4E342E'; ctx.fillRect(dx - 10, dy - 10, b.w + 20, b.h + 20);
            ctx.fillStyle = '#6D4C41'; ctx.fillRect(dx + 12, dy + 12, b.w - 24, b.h - 24);
            // Battlements
            ctx.fillStyle = '#3E2723';
            for (let bx = 0; bx < b.w; bx += 20) {
                ctx.fillRect(dx + bx, dy - 14, 12, 14);
                ctx.fillRect(dx + bx, dy + b.h,  12, 14);
            }
            // Corner towers
            [[-10,-10],[b.w-16,-10],[-10,b.h-16],[b.w-16,b.h-16]].forEach(([ox,oy]) => {
                ctx.fillStyle = '#3E2723'; ctx.fillRect(dx+ox, dy+oy, 26, 26);
                ctx.fillStyle = '#4E342E';
                ctx.beginPath(); ctx.arc(dx+ox+13, dy+oy+13, 13, 0, Math.PI*2); ctx.fill();
            });
            // Flag
            ctx.fillStyle = '#D32F2F'; ctx.fillRect(dx + b.w/2 - 1, dy - 30, 2, 22);
            ctx.beginPath(); ctx.moveTo(dx+b.w/2+1, dy-30); ctx.lineTo(dx+b.w/2+16, dy-23); ctx.lineTo(dx+b.w/2+1, dy-16); ctx.fill();
        } else {
            // Thin tower — ArcherTower entity draws the full structure; just render a ground shadow here
            const tcx = dx + b.w / 2, tcy = dy + b.h / 2;
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.beginPath(); ctx.ellipse(tcx, tcy + 5, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
        }
    });

    // Trees (drawn on top of buildings)
    const trees = WorldGen.getTreesInRect(cx, cy, hw, hh);
    trees.forEach(tree => {
        const dx = tree.x - camera.x;
        const dy = tree.y - camera.y;
        ctx.fillStyle = '#5D4037'; ctx.fillRect(dx - 5, dy - 2, 10, 20);
        ctx.fillStyle = '#1B5E20'; ctx.beginPath(); ctx.arc(dx, dy - 10, 20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2E7D32'; ctx.beginPath(); ctx.arc(dx - 5, dy - 18, 14, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#388E3C'; ctx.beginPath(); ctx.arc(dx + 6,  dy - 15, 12, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#43A047'; ctx.beginPath(); ctx.arc(dx,      dy - 22,  9, 0, Math.PI*2); ctx.fill();
    });
}

const waveManager = {
    currentWave: 1,
    enemiesToSpawn: 0,
    spawnTimer: 0,
    spawnInterval: 1.5,
    bossSpawned: false,
    
    startWave() {
        this.enemiesToSpawn = 5 + (this.currentWave * 3);
        this.spawnInterval = Math.max(0.3, 1.5 - (this.currentWave * 0.05));
        this.bossSpawned = false;
        ui.waveNumber.innerText = this.currentWave;
        showFloatingText(player.x, player.y - 50, `Wave ${this.currentWave}`, "#4CAF50");
    },

    update(dt) {
        // Determine difficulty modifier
        const diffSelect = ui.difficultySelect.value;
        let diffMod = diffSelect === 'hard' ? 1.5 : (diffSelect === 'easy' ? 0.7 : 1);

        this.spawnTimer -= dt;
        
        if (this.spawnTimer <= 0 && this.enemiesToSpawn > 0) {
            this.spawnEnemy(diffMod);
            this.enemiesToSpawn--;
            this.spawnTimer = this.spawnInterval;
        }

        // Check for wave end/boss
        if (this.enemiesToSpawn <= 0 && enemies.length === 0) {
            if (this.currentWave % 5 === 0 && !this.bossSpawned) {
                this.spawnBoss(diffMod);
                this.bossSpawned = true;
            } else if (this.currentWave % 5 !== 0 || (this.currentWave % 5 === 0 && this.bossSpawned)) {
                this.currentWave++;
                this.startWave();
            }
        }
    },

    spawnEnemy(diffMod) {
        // Spawn just outside camera view
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.max(canvas.width, canvas.height) / 2 + 100;
        const x = player.x + Math.cos(angle) * dist;
        const y = player.y + Math.sin(angle) * dist;

        // Select enemy type based on wave
        const availableTypes = MonsterTypes.filter(m => !m.isBoss && MonsterTypes.indexOf(m) <= this.currentWave);
        let type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        
        if(!type) type = MonsterTypes[0]; // fallback

        const enemy = new Enemy(x, y, type);
        // Apply difficulty to hp/speed/damage
        if (diffMod !== 1) {
            if (diffMod === 1.5) { // hard: fast and hits hard, glass-cannon HP
                enemy.maxHp  = Math.floor(enemy.maxHp * 0.8);
                enemy.speed *= 1.2;
                enemy.damage = Math.floor(enemy.damage * 1.3);
            } else { // easy: less HP, slower, softer hits
                enemy.maxHp  = Math.floor(enemy.maxHp * 0.6);
                enemy.speed *= 0.72;
                enemy.damage = Math.floor(enemy.damage * 0.65);
            }
            enemy.hp = enemy.maxHp;
        }
        enemies.push(enemy);
    },

    spawnBoss(diffMod) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 300;
        const x = player.x + Math.cos(angle) * dist;
        const y = player.y + Math.sin(angle) * dist;

        const bossType = MonsterTypes.find(m => m.isBoss);
        const boss = new Enemy(x, y, bossType);
        boss.maxHp *= diffMod;
        boss.hp = boss.maxHp;
        
        showFloatingText(player.x, player.y - 80, "WARNING: BOSS APPROACHING", "red");
        enemies.push(boss);
    }
};

let player;

function updateHUD() {
    if(!player) return;
    ui.hpBarFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
    ui.hpText.innerText = `${Math.floor(player.hp)}/${player.maxHp}`;
    
    if (player.maxMana > 0) {
        ui.manaContainer.classList.remove('hidden');
        ui.manaBarFill.style.width = `${(player.mana / player.maxMana) * 100}%`;
        ui.manaText.innerText = `${Math.floor(player.mana)}/${player.maxMana}`;
    } else {
        ui.manaContainer.classList.add('hidden');
    }

    ui.xpBarFill.style.width = `${(player.xp / player.xpToNext) * 100}%`;
    ui.scoreDisplay.innerText = player.score;
    ui.levelDisplay.innerText = player.level;
    ui.playerNameDisplay.innerText = `${player.classType.toUpperCase()} Lvl ${player.level}`;

    // Attribute stats panel
    ui.statHp.innerText  = player.maxHp;
    ui.statDmg.innerText = player.damage;
    ui.statSpd.innerText = Math.round(player.speed);
    if (player.classType === 'wizard') {
        ui.statAbilityLabel.title = 'Mana Regen (per sec)';
        ui.statAbilityLabel.firstChild.textContent = 'REG ';
        ui.statAbility.innerText = player.manaRegen.toFixed(1);
    } else {
        ui.statAbilityLabel.title = player.classType === 'knight' ? 'Block Power' : 'Fury (lifesteal/crit)';
        ui.statAbilityLabel.firstChild.textContent = 'PWR ';
        ui.statAbility.innerText = player.abilityPower.toFixed(1);
    }

    if (player.classType === 'knight') {
        ui.ammoDisplay.classList.remove('hidden');
        ui.ammoLabel.innerText = 'Arrows';
        ui.ammoCount.innerText = player.arrows;
        ui.ammoDisplay.style.color = '#FFD700';
    } else if (player.classType === 'beast') {
        ui.ammoDisplay.classList.remove('hidden');
        ui.ammoLabel.innerText = 'Rocks';
        ui.ammoCount.innerText = player.rocks;
        ui.ammoDisplay.style.color = '#A1887F';
    } else {
        ui.ammoDisplay.classList.add('hidden');
    }

    // Equipment display
    const armorItem  = player.equipment.armor;
    const ringItem   = player.equipment.ring;
    const shieldItem = player.equipment.shield;
    if (armorItem || ringItem || shieldItem) {
        ui.equipmentDisplay.classList.remove('hidden');
    }
    if (armorItem) {
        ui.armorDisplay.style.color = armorItem.color;
        ui.armorDisplay.innerText = `${armorItem.name} (-${Math.round(armorItem.damageReduction * 100)}%)`;
    } else {
        ui.armorDisplay.style.color = '#555';
        ui.armorDisplay.innerText = 'None';
    }
    if (ringItem) {
        ui.ringDisplay.style.color = ringItem.color;
        ui.ringDisplay.innerText = `${ringItem.name} (+${Math.round((ringItem.damageMult - 1) * 100)}%)`;
    } else {
        ui.ringDisplay.style.color = '#555';
        ui.ringDisplay.innerText = 'None';
    }
    if (shieldItem) {
        if (player.shielding) {
            ui.shieldDisplay.style.color = '#29b6f6';
            ui.shieldDisplay.innerText = `${shieldItem.name} — ACTIVE`;
        } else if (player.shieldCooldownTimer > 0) {
            ui.shieldDisplay.style.color = '#555';
            ui.shieldDisplay.innerText = `${shieldItem.name} — ${Math.ceil(player.shieldCooldownTimer)}s`;
        } else {
            ui.shieldDisplay.style.color = shieldItem.color;
            ui.shieldDisplay.innerText = `${shieldItem.name} — READY [Shift]`;
        }
    } else {
        ui.shieldDisplay.style.color = '#555';
        ui.shieldDisplay.innerText = 'None';
    }
}

function drawBackground() {
    // Simple grid/grass pattern moving with camera
    ctx.fillStyle = "#2a3622"; // Dark grass
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "#334229";
    const tileSize = 50;
    const offsetX = -(camera.x % tileSize);
    const offsetY = -(camera.y % tileSize);

    for (let x = offsetX - tileSize; x < canvas.width; x += tileSize) {
        for (let y = offsetY - tileSize; y < canvas.height; y += tileSize) {
            // Deterministic random spots based on world coordinates
            const worldX = Math.floor((camera.x + x) / tileSize);
            const worldY = Math.floor((camera.y + y) / tileSize);
            const hash = Math.abs(Math.sin(worldX * 12.9898 + worldY * 78.233) * 43758.5453);
            
            if (hash % 1 < 0.1) {
                 // Draw a little tuft of grass
                 ctx.fillRect(x + 10, y + 10, 4, 4);
                 ctx.fillRect(x + 14, y + 8, 4, 6);
            }
        }
    }
}

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // Cap dt to prevent huge jumps
    lastTime = timestamp;

    if (currentState === GameState.PLAYING) {
        // Update
        player.update(dt);
        applyTerrainCollision(player);

        for (let i = enemies.length - 1; i >= 0; i--) {
            // Despawn enemies that have wandered too far — spawn system will repopulate near player
            const despawnDist = Math.max(canvas.width, canvas.height) / 2 + 150;
            if (!enemies[i].isBoss && Math.hypot(enemies[i].x - player.x, enemies[i].y - player.y) > despawnDist) {
                enemies.splice(i, 1);
                continue;
            }
            if (enemies[i].takeDamage === true || enemies[i].update(dt) === true) {
                // Already handled inside takeDamage, or update returned true
            }
            if (enemies[i].hp <= 0) { enemies.splice(i, 1); continue; }
            applyTerrainCollision(enemies[i]);
        }

        for (let i = projectiles.length - 1; i >= 0; i--) {
            if (projectiles[i].update(dt)) {
                projectiles.splice(i, 1);
            }
        }
// Item pickups (health orbs, arrows, rocks)
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            item.life -= dt;
            item.bob += dt * 3;
            if (item.life <= 0) { items.splice(i, 1); continue; }
            if (Math.hypot(player.x - item.x, player.y - item.y) < player.size / 2 + item.size) {
                if (item.type === 'arrow') {
                    player.arrows += item.amount;
                    showFloatingText(item.x, item.y - 10, `+${item.amount} Arrows`, '#FFD700');
                    updateHUD();
                } else if (item.type === 'rock') {
                    player.rocks += item.amount;
                    showFloatingText(item.x, item.y - 10, `+${item.amount} Rocks`, '#A1887F');
                    updateHUD();
                } else {
                    player.heal(item.heal);
                    showFloatingText(item.x, item.y - 10, `+${item.heal} HP`, '#4CAF50');
                }
                items.splice(i, 1);
            }
        }

        
                spawnManager.update(dt);

        // Lazy-spawn Archer Towers at WorldGen tower positions near the player
        WorldGen.getBuildingsNear(player.x, player.y, 700).forEach(b => {
            if (b.type !== 'tower') return;
            const key = `${Math.round(b.wx / WorldGen.BUILDING_GRID)},${Math.round(b.wy / WorldGen.BUILDING_GRID)}`;
            if (!spawnedTowerKeys.has(key)) {
                spawnedTowerKeys.add(key);
                archerTowers.push(new ArcherTower(b.wx, b.wy));
            }
        });

        // Update Archer Towers
        for (let i = archerTowers.length - 1; i >= 0; i--) {
            archerTowers[i].update(dt);
            if (archerTowers[i].dead) archerTowers.splice(i, 1);
        }

        // Chest pickup detection
        for (const chest of chests) {
            if (!chest.opened && Math.hypot(player.x - chest.x, player.y - chest.y) < player.size / 2 + 16) {
                chest.opened = true;
                const item = chest.loot;
                player.equipment[item.slot] = item;
                const statText = item.slot === 'armor'
                    ? `-${Math.round(item.damageReduction * 100)}% dmg taken`
                    : `+${Math.round((item.damageMult - 1) * 100)}% dmg dealt`;
                showFloatingText(chest.x, chest.y - 30, `${item.name}!`, item.color);
                showFloatingText(chest.x, chest.y - 50, statText, item.color);
                updateHUD();
            }
        }

        // Periodic ammo world-spawning (arrows for knight, rocks for beast only)
        if (player.classType === 'knight' || player.classType === 'beast') {
            ammoSpawnTimer -= dt;
            if (ammoSpawnTimer <= 0) {
                const angle = Math.random() * Math.PI * 2;
                const dist  = 250 + Math.random() * 350;
                const isArrow = player.classType === 'knight';
                items.push({
                    x: player.x + Math.cos(angle) * dist,
                    y: player.y + Math.sin(angle) * dist,
                    size: 8, type: isArrow ? 'arrow' : 'rock',
                    amount: isArrow ? (2 + Math.floor(Math.random() * 4)) : (1 + Math.floor(Math.random() * 3)),
                    life: 30, bob: Math.random() * Math.PI * 2
                });
                ammoSpawnTimer = 9 + Math.random() * 6;
            }
        }

        updateHUD();

        // Clear screen
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground();
        drawTerrain();

        // Sort entities by Y for pseudo depth
        const renderList = [player, ...enemies, ...archerTowers].sort((a, b) => a.y - b.y);
        
        renderList.forEach(entity => {
            if (entity === player) player.drawPlayer();
            else entity.draw();
        });

        projectiles.forEach(p => p.draw());

        // World items (health orbs, arrows, rocks)
        items.forEach(item => {
            const drawX = item.x - camera.x;
            const drawY = item.y - camera.y + Math.sin(item.bob) * 3;
            ctx.globalAlpha = item.life < 3 ? item.life / 3 : 1;
            if (item.type === 'arrow') {
                ctx.save();
                ctx.translate(drawX, drawY);
                ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(6, 0); ctx.stroke();
                ctx.fillStyle = '#FFD700';
                ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(3, -3); ctx.lineTo(3, 3); ctx.fill();
                ctx.restore();
                ctx.fillStyle = '#FFD700'; ctx.font = 'bold 9px Courier New';
                ctx.fillText(`x${item.amount}`, drawX + 8, drawY - 5);
            } else if (item.type === 'rock') {
                ctx.fillStyle = '#8D6E63';
                ctx.beginPath(); ctx.arc(drawX, drawY, item.size, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#BCAAA4';
                ctx.beginPath(); ctx.arc(drawX - 2, drawY - 2, item.size * 0.4, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#A1887F'; ctx.font = 'bold 9px Courier New';
                ctx.fillText(`x${item.amount}`, drawX + item.size, drawY - 5);
            } else {
                ctx.fillStyle = '#4CAF50';
                ctx.beginPath(); ctx.arc(drawX, drawY, item.size, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.fillRect(drawX - item.size * 0.55, drawY - item.size * 0.18, item.size * 1.1, item.size * 0.36);
                ctx.fillRect(drawX - item.size * 0.18, drawY - item.size * 0.55, item.size * 0.36, item.size * 1.1);
            }
            ctx.globalAlpha = 1;
        });

        // Treasure chests
        chests.forEach(chest => {
            const drawX = chest.x - camera.x;
            const drawY = chest.y - camera.y;
            if (drawX < -40 || drawX > canvas.width + 40 || drawY < -40 || drawY > canvas.height + 40) return;
            if (chest.opened) {
                // Open chest – darker, hollow look
                ctx.fillStyle = '#4e342e';
                ctx.fillRect(drawX - 13, drawY - 2, 26, 12);
                ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 1;
                ctx.strokeRect(drawX - 13, drawY - 2, 26, 12);
            } else {
                const rarityColor = chest.loot.color;
                // Body
                ctx.fillStyle = '#795548';
                ctx.fillRect(drawX - 13, drawY - 7, 26, 14);
                // Lid band
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(drawX - 13, drawY - 7, 26, 5);
                // Lock
                ctx.fillStyle = rarityColor;
                ctx.fillRect(drawX - 3, drawY - 4, 6, 7);
                ctx.fillStyle = '#4e342e';
                ctx.fillRect(drawX - 1, drawY - 1, 2, 3);
                // Rarity glow outline
                ctx.strokeStyle = rarityColor; ctx.lineWidth = 1;
                ctx.strokeRect(drawX - 14, drawY - 8, 28, 16);
                // Label above
                ctx.fillStyle = rarityColor;
                ctx.font = 'bold 8px Courier New';
                ctx.textAlign = 'center';
                ctx.fillText('CHEST', drawX, drawY - 12);
                ctx.textAlign = 'left';
            }
        });

        // 
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
            } else {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life * 2;
                ctx.fillRect(p.x - camera.x, p.y - camera.y, p.size, p.size);
                ctx.globalAlpha = 1.0;
            }
        }

        // Floating Text
        for (let i = floatTexts.length - 1; i >= 0; i--) {
            const ft = floatTexts[i];
            ft.y -= 30 * dt;
            ft.life -= dt;
            if (ft.life <= 0) {
                floatTexts.splice(i, 1);
            } else {
                ctx.fillStyle = ft.color;
                ctx.font = ft.isCrit ? "bold 24px Courier New" : "bold 16px Courier New";
                ctx.globalAlpha = ft.life / ft.maxLife;
                // Center text
                const metrics = ctx.measureText(ft.text);
                ctx.fillText(ft.text, ft.x - camera.x - metrics.width/2, ft.y - camera.y);
                ctx.globalAlpha = 1.0;
            }
        }

        // World coordinates display
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(8, canvas.height - 30, 180, 22);
        ctx.fillStyle = '#aaa';
        ctx.font = '12px Courier New';
        ctx.textAlign = 'left';
        ctx.fillText(`X: ${Math.round(player.x)}  Y: ${Math.round(player.y)}`, 14, canvas.height - 13);
    }

    if (currentState !== GameState.MENU) {
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

function startGame(className, loadedData = null) {
    ui.startScreen.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ui.mobileControls.classList.remove('hidden');
    ui.actionBtn.classList.remove('hidden');
    ui.rangedBtn.classList.remove('hidden');
    
            if (loadedData) {
        // Restore state
        player = new Player(Classes[loadedData.classType]);
        Object.assign(player, loadedData.player);
    } else {
        player = new Player(Classes[className]);
    }
    
    // Set ability text
    document.getElementById('ability-upgrade-btn').innerText = `+ Improve ${Classes[player.classType === 'wizard'?'wizard':(player.classType==='knight'?'human':'beast')].abilityName}`;

    enemies = [];
    projectiles = [];
    particles = [];
    items = [];
    floatTexts = [];
    chests = CHEST_SPAWN_DATA.map(pos => ({ x: pos.x, y: pos.y, opened: false, loot: pos.loot }));
    archerTowers = [];
    spawnedTowerKeys.clear();
    
    spawnManager.spawnTimer = 0;
    spawnManager.lastBossLevel = 0;
    spawnManager.bossSpawned = false;
    ammoSpawnTimer = 5;
    updateHUD();
    
    currentState = GameState.PLAYING;
    lastTime = 0; // reset delta time
    cancelAnimationFrame(animationFrameId);
    gameLoop(performance.now());
}

function pauseGame() {
    currentState = GameState.PAUSED;
    ui.pauseMenu.classList.remove('hidden');
    ui.saveMsg.innerText = "";
}

function resumeGame() {
    currentState = GameState.PLAYING;
    ui.pauseMenu.classList.add('hidden');
    lastTime = performance.now(); // Prevent large delta time
}

function triggerLevelUpScreen() {
    currentState = GameState.LEVEL_UP;
    document.getElementById('new-level-display').innerText = player.level;

    // Show exact gain on each button
    document.querySelector('[data-stat="maxHp"]').innerText    = `❤ Vitality  — Max HP ${player.maxHp} → ${player.maxHp + 25}`;
    document.querySelector('[data-stat="damage"]').innerText   = `⚔ Strength  — Damage ${player.damage} → ${player.damage + 5}`;
    document.querySelector('[data-stat="speed"]').innerText    = `⚡ Agility   — Speed ${Math.round(player.speed)} → ${Math.round(player.speed + 10)}`;

    const abilityBtn = document.querySelector('[data-stat="ability"]');
    if (player.classType === 'wizard') {
        abilityBtn.innerText = `🔮 Arcane Power — Mana ${player.maxMana} → ${player.maxMana + 30},  Regen ${player.manaRegen.toFixed(1)} → ${(player.manaRegen + 2).toFixed(1)}/s`;
    } else if (player.classType === 'knight') {
        abilityBtn.innerText = `🛡 Block Power  — ${player.abilityPower.toFixed(1)} → ${(player.abilityPower + 0.2).toFixed(1)}x mitigation`;
    } else {
        abilityBtn.innerText = `🐾 Fury         — ${player.abilityPower.toFixed(1)} → ${(player.abilityPower + 0.5).toFixed(1)}x lifesteal/crit`;
    }

    ui.levelUpScreen.classList.remove('hidden');
}

function gameOver(killerName = null) {
    currentState = GameState.GAME_OVER;
    ui.hud.classList.add('hidden');
    ui.mobileControls.classList.add('hidden');
    ui.actionBtn.classList.add('hidden');
    ui.rangedBtn.classList.add('hidden');
    
    document.getElementById('death-level').innerText = player.level;
    document.getElementById('death-score').innerText = player.score;
    document.getElementById('death-kills').innerText = player.kills;
    document.getElementById('death-killer').innerText = killerName || 'Unknown';
    
    ui.gameOverScreen.classList.remove('hidden');
    
    // Clear save on death so a new game starts fresh
    deleteSaveGame();
}

function returnToMenu() {
    currentState = GameState.MENU;
    cancelAnimationFrame(animationFrameId);
    ui.pauseMenu.classList.add('hidden');
    ui.gameOverScreen.classList.add('hidden');
    ui.hud.classList.add('hidden');
    ui.mobileControls.classList.add('hidden');
    ui.actionBtn.classList.add('hidden');
    ui.rangedBtn.classList.add('hidden');
    ui.startScreen.classList.remove('hidden');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function saveGame() {
    const saveData = {
        player: {
            level: player.level, xp: player.xp, xpToNext: player.xpToNext,
            score: player.score, kills: player.kills,
            maxHp: player.maxHp, hp: player.hp,
            damage: player.damage, speed: player.speed,
            abilityPower: player.abilityPower
        },
        classType: player.classType === 'knight' ? 'human' : player.classType,
        level: player.level,
        timestamp: new Date().toISOString()
    };

    try {
        localStorage.setItem('endlessChronicles_save', JSON.stringify(saveData));
        ui.saveMsg.innerText = "Game Saved!";
        ui.saveMsg.className = "mt-4 text-sm text-green-400 h-4";
        ui.loadSaveBtn.classList.remove('hidden');
    } catch (e) {
        console.error("Save error:", e);
        ui.saveMsg.innerText = "Save Failed.";
        ui.saveMsg.className = "mt-4 text-sm text-red-400 h-4";
    }
}

function checkSaveGame() {
    return !!localStorage.getItem('endlessChronicles_save');
}

function loadGame() {
    try {
        const raw = localStorage.getItem('endlessChronicles_save');
        if (raw) {
            startGame(null, JSON.parse(raw));
        }
    } catch (e) {
        console.error("Load error:", e);
    }
}

function deleteSaveGame() {
    localStorage.removeItem('endlessChronicles_save');
}


// UI Interaction Binding
ui.classCards.forEach(card => {
    card.addEventListener('click', () => {
        ui.classCards.forEach(c => c.style.borderColor = 'var(--border-color)');
        
        // Set specific border color based on class
        const type = card.dataset.class;
        let color = 'white';
        if(type === 'human') color = 'var(--accent-color)';
        if(type === 'wizard') color = 'var(--wizard-color)';
        if(type === 'beast') color = 'var(--beast-color)';
        
        card.style.borderColor = color;
        selectedClass = type;
        ui.startNewBtn.classList.remove('hidden');
    });
});

ui.startNewBtn.addEventListener('click', () => {
    if(selectedClass) startGame(selectedClass);
});

ui.loadSaveBtn.addEventListener('click', loadGame);

ui.menuBtn.addEventListener('click', pauseGame);
ui.resumeBtn.addEventListener('click', resumeGame);
ui.saveBtn.addEventListener('click', saveGame);
ui.quitBtn.addEventListener('click', returnToMenu);
ui.restartBtn.addEventListener('click', returnToMenu);

// Bestiary Modal
const showBestiary = () => { ui.bestiaryScreen.classList.remove('hidden'); };
const hideBestiary = () => { ui.bestiaryScreen.classList.add('hidden'); };

ui.showBestiaryBtn.addEventListener('click', showBestiary);
ui.menuBestiaryBtn.addEventListener('click', showBestiary);
ui.closeBestiaryBtn.addEventListener('click', hideBestiary);

// Level Up Upgrades
document.querySelectorAll('.upgrade-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const stat = e.target.dataset.stat;
        if (stat === 'maxHp') {
            player.maxHp += 25;
            player.hp += 25;
        } else if (stat === 'damage') {
            player.damage += 5;
        } else if (stat === 'speed') {
            player.speed += 10;
        } else if (stat === 'ability') {
            if (player.classType === 'wizard') {
                // Wizard: increase max mana and mana regen
                player.maxMana += 30;
                player.mana += 30;
                player.manaRegen += 2;
            } else if (player.classType === 'knight') {
                // Knight: improve block ability
                player.abilityPower += 0.2;
            } else {
                // Beast: improve lifesteal/crit
                player.abilityPower += 0.5;
            }
        }
        
        updateHUD();
        ui.levelUpScreen.classList.add('hidden');
        
        // Small delay before resuming to prevent instant hits
        setTimeout(() => {
             lastTime = performance.now();
             currentState = GameState.PLAYING;
        }, 100);
    });
});

// Initialize: show class selection immediately, check for an existing local save
ui.classSelection.classList.remove('hidden');
if (checkSaveGame()) {
    ui.loadSaveBtn.classList.remove('hidden');
}

// Draw character sprites onto the class-selection preview canvases
(function drawClassPreviews() {
    function drawKnight(c) {
        // Sword
        c.fillStyle = '#CFD8DC'; c.fillRect(46, 6, 4, 28);
        c.fillStyle = '#795548'; c.fillRect(46, 32, 4, 10);
        c.fillStyle = '#9E9E9E'; c.fillRect(40, 31, 16, 4);

        // Shield
        c.fillStyle = '#1565C0';
        c.beginPath(); c.moveTo(6,26); c.lineTo(16,26); c.lineTo(16,44); c.lineTo(11,52); c.lineTo(6,44); c.closePath(); c.fill();
        c.fillStyle = '#FFD700'; c.fillRect(9, 28, 2, 18); c.fillRect(10, 27, 4, 2);

        // Legs
        c.fillStyle = '#546E7A'; c.fillRect(20, 44, 8, 12); c.fillRect(32, 44, 8, 12);

        // Body armor
        c.fillStyle = '#78909C'; c.fillRect(16, 26, 28, 20);
        c.fillStyle = '#90A4AE'; c.fillRect(17, 27, 26, 8);
        c.fillStyle = '#607D8B'; c.fillRect(10, 24, 8, 8); c.fillRect(42, 24, 8, 8); // pauldrons

        // Helmet
        c.fillStyle = '#607D8B'; c.fillRect(18, 8, 24, 18);
        c.fillStyle = '#546E7A'; c.fillRect(26, 4, 8, 6); // top ridge
        c.fillStyle = '#37474F'; c.fillRect(18, 18, 24, 4); // visor band
        c.fillStyle = '#E3F2FD'; c.fillRect(20, 19, 7, 2); c.fillRect(33, 19, 7, 2); // eye slits
        c.fillStyle = '#455A64'; c.fillRect(28, 14, 4, 10); // nasal guard
    }

    function drawWizard(c) {
        // Staff with glowing orb
        c.fillStyle = '#6D4C41'; c.fillRect(46, 14, 3, 42);
        c.fillStyle = '#00E5FF';
        c.beginPath(); c.arc(47, 10, 7, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(0,229,255,0.4)'; c.lineWidth = 4;
        c.beginPath(); c.arc(47, 10, 11, 0, Math.PI * 2); c.stroke();

        // Robe (trapezoid)
        c.fillStyle = '#7B1FA2';
        c.beginPath(); c.moveTo(18,28); c.lineTo(8,56); c.lineTo(52,56); c.lineTo(42,28); c.closePath(); c.fill();
        c.strokeStyle = '#4A148C'; c.lineWidth = 1; c.stroke();
        // Stars on robe
        c.fillStyle = '#FFD700';
        c.fillRect(16, 36, 4, 4); c.fillRect(30, 44, 4, 4); c.fillRect(42, 36, 4, 4);
        c.fillRect(22, 48, 4, 4); c.fillRect(38, 50, 4, 4);

        // Head
        c.fillStyle = '#FFE0B2';
        c.beginPath(); c.arc(30, 28, 10, 0, Math.PI * 2); c.fill();

        // Bushy eyebrows
        c.fillStyle = '#9E9E9E'; c.fillRect(22, 22, 7, 2); c.fillRect(31, 22, 7, 2);
        // Eyes
        c.fillStyle = '#1A237E'; c.fillRect(24, 25, 4, 3); c.fillRect(32, 25, 4, 3);
        // White beard
        c.fillStyle = '#EEEEEE'; c.fillRect(22, 32, 16, 5); c.fillRect(24, 37, 12, 3);

        // Wizard hat — brim then cone
        c.fillStyle = '#6A1B9A'; c.fillRect(13, 16, 34, 5);
        c.beginPath(); c.moveTo(17, 17); c.lineTo(30, 1); c.lineTo(43, 17); c.closePath(); c.fill();
        c.fillStyle = '#FFD700'; c.fillRect(13, 13, 34, 3); // hat band
        // Cross star on hat
        c.fillStyle = '#FFD700'; c.fillRect(27, 6, 6, 2); c.fillRect(29, 4, 2, 6);
    }

    function drawBeast(c) {
        // Body
        c.fillStyle = '#FFCC80'; c.fillRect(14, 30, 32, 22);
        c.strokeStyle = '#E65100'; c.lineWidth = 2; c.strokeRect(14, 30, 32, 22);
        // Fur stripes
        c.fillStyle = '#FF8F00'; c.fillRect(20, 32, 4, 20); c.fillRect(36, 32, 4, 20);

        // Legs
        c.fillStyle = '#EF6C00'; c.fillRect(16, 50, 10, 8); c.fillRect(34, 50, 10, 8);
        // Toe claws
        c.fillStyle = '#FFF8E1';
        c.fillRect(14,57,3,3); c.fillRect(18,58,3,3); c.fillRect(22,57,3,3);
        c.fillRect(36,57,3,3); c.fillRect(40,58,3,3); c.fillRect(44,57,3,3);

        // Arms
        c.fillStyle = '#FFCC80'; c.fillRect(4,30,10,16); c.fillRect(46,30,10,16);
        // Arm claws
        c.fillStyle = '#FFF8E1';
        c.fillRect(2,44,3,5); c.fillRect(6,46,3,5); c.fillRect(10,44,3,5);
        c.fillRect(48,44,3,5); c.fillRect(52,46,3,5); c.fillRect(56,44,3,5);

        // Head (wide)
        c.fillStyle = '#FFCC80'; c.fillRect(12, 10, 36, 22);
        c.strokeStyle = '#E65100'; c.lineWidth = 2; c.strokeRect(12, 10, 36, 22);

        // Ears (pointed)
        c.fillStyle = '#EF6C00';
        c.beginPath(); c.moveTo(12,10); c.lineTo(5,0); c.lineTo(20,10); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(48,10); c.lineTo(55,0); c.lineTo(40,10); c.closePath(); c.fill();
        // Inner ears
        c.fillStyle = '#FF8A65';
        c.beginPath(); c.moveTo(13,10); c.lineTo(8,3); c.lineTo(18,10); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(47,10); c.lineTo(52,3); c.lineTo(42,10); c.closePath(); c.fill();

        // Snout / muzzle
        c.fillStyle = '#FFAB40'; c.fillRect(18, 22, 24, 8);
        c.fillStyle = '#4E342E'; c.fillRect(26, 22, 8, 5); // nose
        c.fillStyle = '#FF8A65'; c.fillRect(27,23,3,2); c.fillRect(32,23,3,2); // nostrils

        // Animal eyes (amber with slit pupils)
        c.fillStyle = '#FF6F00'; c.fillRect(14,12,10,8); c.fillRect(36,12,10,8);
        c.fillStyle = '#212121'; c.fillRect(18,13,2,7); c.fillRect(40,13,2,7); // slit pupils
        c.fillStyle = '#FFF'; c.fillRect(15,13,2,2); c.fillRect(37,13,2,2); // highlights

        // Teeth
        c.fillStyle = '#FFF';
        c.fillRect(22,29,3,4); c.fillRect(27,29,3,4); c.fillRect(33,29,3,4); c.fillRect(38,29,3,4);
    }

    document.querySelectorAll('.class-preview-canvas').forEach(pc => {
        const c = pc.getContext('2d');
        c.imageSmoothingEnabled = false;
        c.clearRect(0, 0, 60, 60);
        if (pc.dataset.class === 'human') drawKnight(c);
        else if (pc.dataset.class === 'wizard') drawWizard(c);
        else drawBeast(c);
    });
})();

// Initial draw for background of menu
ctx.fillStyle = "#111";
ctx.fillRect(0,0, canvas.width, canvas.height);
