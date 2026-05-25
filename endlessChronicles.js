// ============================================================
// ENDLESS CHRONICLES: REALM OF GRUMBLESHIRE
// "Where things are mostly terrible and loot is sometimes good"
// Sacred Seed of Destiny: 69420 (as foretold by Gerald the Frog)
// ============================================================
'use strict';

// § 1 ─ SETUP & CONSTANTS ────────────────────────────────────
const WORLD_SEED  = 69420;
const TILE_SIZE   = 32;
const CHUNK_TILES = 16;
const CHUNK_PX    = CHUNK_TILES * TILE_SIZE;  // 512 pixels
const TREE_COLL_R = 13;
const TOWN_RADIUS = 380;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', () => {
    resizeCanvas();
    if (player && currentState === GameState.PLAYING) {
        camera.x = player.x - canvas.width  / 2;
        camera.y = player.y - canvas.height / 2;
    }
});

const GameState = Object.freeze({ MENU:'menu', PLAYING:'playing', PAUSED:'paused', LEVEL_UP:'level_up', GAME_OVER:'game_over' });
let currentState = GameState.MENU;
let lastTime = 0;
let animationFrameId = null;
const keys   = {};
const camera = { x:0, y:0 };
let player   = null;

// § 2 ─ SEEDED NOISE ─────────────────────────────────────────
function seededHash(a, b) {
    let n = Math.imul(a * 374761393 ^ b * 668265263, WORLD_SEED | 1);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function smoothNoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
    const a = seededHash(ix,   iy),   b = seededHash(ix+1, iy);
    const c = seededHash(ix,   iy+1), d = seededHash(ix+1, iy+1);
    return a*(1-ux)*(1-uy) + b*ux*(1-uy) + c*(1-ux)*uy + d*ux*uy;
}
function octaveNoise(x, y, oct = 4) {
    let v=0, amp=1, freq=1, max=0;
    for (let i=0;i<oct;i++){ v+=smoothNoise(x*freq,y*freq)*amp; max+=amp; amp*=0.5; freq*=2; }
    return v / max;
}

// § 3 ─ BIOMES ────────────────────────────────────────────────
const Biomes = {
    PLAINS:   { id:'plains',   name:'Ticklegrass Plains',              minimapColor:'#3d6b28', tileColors:['#4a8c3f','#5a9c4f','#3e7a35','#508a42'], treeChance:0.04,  difficulty:1 },
    FOREST:   { id:'forest',   name:'Murmuring Murk',                  minimapColor:'#163016', tileColors:['#1e4a1e','#263c26','#1a3818','#2a4422'], treeChance:0.30,  difficulty:2 },
    DESERT:   { id:'desert',   name:'The Sandy Bits',                  minimapColor:'#b09040', tileColors:['#c4a04a','#d0b05a','#b89040','#c8a850'], treeChance:0.008, difficulty:3 },
    BOG:      { id:'bog',      name:'Soggy Bog of Despair',            minimapColor:'#2e3e1c', tileColors:['#354528','#2e3c22','#3e4e2e','#2a3818'], treeChance:0.12,  difficulty:3 },
    TUNDRA:   { id:'tundra',   name:'Frostbitten Tundra',              minimapColor:'#90a8bc', tileColors:['#b0c8d8','#c0d8e8','#a0b8cc','#c8dce8'], treeChance:0.07,  difficulty:4 },
    RUINS:    { id:'ruins',    name:'Ruins of Wobblethwaite',          minimapColor:'#585050', tileColors:['#6a6050','#5a5040','#7a7060','#5e5448'], treeChance:0.06,  difficulty:4 },
    VOLCANIC: { id:'volcanic', name:'Doom Fields of Questionable Lava',minimapColor:'#5a1000', tileColors:['#2a1206','#1c0c04','#381808','#28100a'], treeChance:0.003, difficulty:5 },
    VOID:     { id:'void',     name:'Void of Questionable Decisions',  minimapColor:'#080820', tileColors:['#050510','#080818','#040410','#0a0a20'], treeChance:0,     difficulty:6 },
};

const _biomeCache = new Map();
function getBiomeAtTile(tx, ty) {
    const key = `${tx},${ty}`;
    if (_biomeCache.has(key)) return _biomeCache.get(key);
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
    if (_biomeCache.size > 50000) _biomeCache.clear();
    _biomeCache.set(key, biome);
    return biome;
}
function getBiomeAtWorld(wx, wy) {
    return getBiomeAtTile(Math.floor(wx / TILE_SIZE), Math.floor(wy / TILE_SIZE));
}

// § 4 ─ WORLD DATA ────────────────────────────────────────────

// ── Towns ──
const TOWNS = [
    {
        id:'flumpton', name:'Flumpton', subtitle:'"Population: 23 (and Falling)"',
        tileX:0, tileY:-32,
        buildings:[
            { tx:-12, ty:-6, tw:14, th:9,  type:'inn',      label:'The Wobbly Bucket Inn' },
            { tx: 4,  ty:-5, tw:11, th:7,  type:'shop',     label:"Bob's Questionable Wares" },
            { tx:-7,  ty: 4, tw:8,  th:6,  type:'house',    label:'' },
            { tx: 4,  ty: 3, tw:8,  th:6,  type:'house',    label:'' },
            { tx:-2,  ty:-3, tw:7,  th:5,  type:'townhall', label:'Town Hall (Unfinished)' },
        ],
        npcs:[
            { tx:-4, ty:1,  name:'Reginald the Uncertain', dialogue:[
                '"Oh. A hero. Wonderful. Not that we were panicking."',
                '"The Murmuring Murk forest is to the northeast. Full of wolves. They are very committed."',
                '"Our last hero left three years ago. We assume he is fine. We have largely stopped assuming."',
            ]},
            { tx: 6, ty:1,  name:"Bob the Merchant", isMerchant:true, dialogue:[
                '"Everything must go! (Please. It really must.)"',
                '"My finest wares. Some of them have only been slightly cursed."',
                '"Looking to buy? I sell things. Mostly things. Come back when less sweaty."',
            ]},
            { tx: 1, ty:-2, name:'Seer Petronella', dialogue:[
                '"I see great peril in your future. Also moderate peril. Really quite a lot of peril overall."',
                '"The Ancient Ruins to the east... best avoided. Or go there. I\'m a seer, not your mother."',
                '"Beware the Void. Grand Witch Snorflaxia waits there. She has been waiting for 200 years. She is not pleased."',
            ]},
            { tx:-5, ty: 4, name:'Bert the Farmer', dialogue:[
                '"My cabbages! The Giant Rats have eaten seventeen cabbages this week."',
                '"If you see any rats, please do the needful. I will not specify what the needful is."',
                '"Forty years I have farmed. Forty years of cabbages. And still: rats."',
            ]},
        ],
        knownChests:[ {tx:-14,ty:-3,loot:'ARMOR_ITEMS[0]'}, {tx:6,ty:-7,loot:'RING_ITEMS[0]'} ],
    },
    {
        id:'bumblesnatch', name:'Bumblesnatch', subtitle:'"Est. by Accident, Continued by Stubbornness"',
        tileX:360, tileY:-230,
        buildings:[
            { tx:-10, ty:-5, tw:13, th:8,  type:'inn',   label:'The Soggy Log Tavern' },
            { tx:  5, ty:-4, tw:10, th:7,  type:'shop',  label:"Myrtle's Woodland Emporium" },
            { tx: -6, ty: 4, tw: 8, th:5,  type:'house', label:'' },
            { tx:  4, ty: 4, tw: 8, th:5,  type:'house', label:'' },
        ],
        npcs:[
            { tx:-3, ty:-1, name:'Guildmaster Hogbert', dialogue:[
                '"Welcome to Bumblesnatch. Mind the wolves. They are everywhere."',
                '"We chose this location because it was the least terrible option available."',
                '"The forest is dangerous. We know this. We stay anyway. It\'s called commitment."',
            ]},
            { tx: 4, ty: 1, name:'Myrtle the Shopkeeper', isMerchant:true, dialogue:[
                '"Better gear? Yes. Costs extra. Wolves ate my last supplier."',
                '"Don\'t mind the howling. It\'s probably just the wind. (It is not the wind.)"',
            ]},
            { tx: 0, ty: 3, name:'Timbo the Lost', dialogue:[
                '"I came here looking for Sandpocket. Six years ago."',
                '"Sandpocket is to the west. Across the desert. You can\'t miss it. I missed it."',
                '"Follow the road west. Or east. Mostly west though."',
            ]},
        ],
        knownChests:[ {tx:8,ty:-3,loot:'ARMOR_ITEMS[1]'} ],
    },
    {
        id:'sandpocket', name:'Sandpocket', subtitle:'"Our Water Costs More Than Gold"',
        tileX:-520, tileY:110,
        buildings:[
            { tx:-11, ty:-5, tw:14, th:9,  type:'inn',      label:'The Dry Well Inn' },
            { tx:  5, ty:-4, tw:10, th:7,  type:'shop',     label:"Xerxes' Desert Goods" },
            { tx: -8, ty: 4, tw: 9, th:6,  type:'house',    label:'' },
            { tx:  4, ty: 3, tw: 8, th:5,  type:'house',    label:'' },
            { tx: -1, ty: 4, tw: 7, th:5,  type:'townhall', label:'Trade Post' },
        ],
        npcs:[
            { tx:-4, ty: 0, name:'Xerxes the Seller', isMerchant:true, dialogue:[
                '"Water? Five gold. Air? Four gold. Leaving? Priceless. Please do it."',
                '"The Skeleton Archers Union Local #47 is on strike again. My commute is a nightmare."',
            ]},
            { tx: 4, ty:-1, name:'Desert Hermit Voss', dialogue:[
                '"I have walked this desert for thirty years. I have found: sand."',
                '"The Ruins are to the northeast. Ancient. Powerful. Absolutely haunted, do not let anyone tell you otherwise."',
                '"The Medusa lives out there. Do NOT look at her directly. Do not look at her indirectly either."',
            ]},
            { tx: 0, ty: 2, name:'Captain Sunblasted', dialogue:[
                '"Sand Scorpions burrow. You will not hear them. You will feel them. This is the last warning you get."',
                '"We patrol these dunes daily. The scorpions patrol more days than we do."',
            ]},
        ],
        knownChests:[ {tx:7,ty:-2,loot:'RING_ITEMS[1]'} ],
    },
    {
        id:'grimwhistle', name:'Grimwhistle', subtitle:'"Come for the Misery, Stay Because Your Boots Got Stuck"',
        tileX:230, tileY:720,
        buildings:[
            { tx:-9,  ty:-5, tw:12, th:8, type:'inn',   label:'The Murky Depths Hostel' },
            { tx: 5,  ty:-4, tw: 9, th:6, type:'shop',  label:"Griselda's Swamp Goods" },
            { tx:-6,  ty: 4, tw: 7, th:5, type:'house', label:'' },
            { tx: 3,  ty: 4, tw: 7, th:5, type:'house', label:'' },
        ],
        npcs:[
            { tx:-2, ty:-1, name:'Griselda the Merchant', isMerchant:true, dialogue:[
                '"Everything I sell is slightly damp. That\'s just the nature of the bog."',
                '"Hydra parts? Yes I have those. No I will not explain how I obtained them."',
            ]},
            { tx: 3, ty: 1, name:'Sogbert the Local', dialogue:[
                '"It has not stopped raining in eleven years. We have adapted."',
                '"The Toxic Slimes breed in the pools. Avoid green puddles. And most other puddles."',
                '"Deeper in the bog there is a ruin. Something large sleeps there. Something annoyed."',
            ]},
            { tx:-5, ty: 2, name:'Witch Margolaine', dialogue:[
                '"I sense great power in you. Or indigestion. Could genuinely be either."',
                '"The Wraiths are drawn to fear. Try not to be afraid. (You should be afraid.)"',
                '"Travel further south and east for the Ruins. Further still for the Doom Fields. Further still for whatever sent the Doom Fields fleeing."',
            ]},
        ],
        knownChests:[ {tx:8,ty:-6,loot:'SHIELD_ITEMS[1]'} ],
    },
    {
        id:'frostholm', name:'Frostholm', subtitle:'"Too Cold to Leave, Too Stubborn to Care"',
        tileX:-840, tileY:-800,
        buildings:[
            { tx:-12, ty:-6, tw:14, th:9, type:'inn',      label:'The Frozen Mug Tavern' },
            { tx:  6, ty:-5, tw:10, th:7, type:'shop',     label:"Sigrid's Cold Comfort" },
            { tx: -8, ty: 4, tw: 9, th:6, type:'house',    label:'' },
            { tx:  3, ty: 3, tw: 8, th:5, type:'house',    label:'' },
            { tx: -1, ty: 5, tw: 7, th:5, type:'townhall', label:'The Frozen Council Hall' },
        ],
        npcs:[
            { tx:-4, ty:-1, name:'Sigrid Frosthammer', isMerchant:true, dialogue:[
                '"My goods are the finest in the frozen north. Also the only goods."',
                '"Ice Golems are slow. You are faster. Probably."',
            ]},
            { tx: 4, ty: 0, name:'Jarl Grunwald', dialogue:[
                '"You came from the south? In those clothes? Remarkable. Foolish, but remarkable."',
                '"The Minotaurs roam these frozen plains. They dislike visitors. Intensely."',
                '"Beyond the tundra: Doom Fields. No one returns. Except Berta. She came back and now she just says \'hot\' repeatedly."',
            ]},
            { tx: 0, ty: 3, name:'Berta (Was Fine)', dialogue:[
                '"Hot," she says.',
                '"I went to the Doom Fields. Very hot. Did not enjoy it. Would not recommend."',
                '"The Fire Elementals there are... energetic. You will need powerful enchantments or exceptional luck."',
                '"At the very center of the Void something ancient waits. Grand Witch Snorflaxia. 200 years of waiting. She is quite put out."',
            ]},
        ],
        knownChests:[ {tx:-14,ty:-3,loot:'ARMOR_ITEMS[2]'}, {tx:8,ty:-7,loot:'RING_ITEMS[2]'} ],
    },
];
const ROAD_CONNECTIONS = [[0,1],[0,2],[0,3],[0,4]];

function distToSegment(px, py, ax, ay, bx, by) {
    const dx=bx-ax, dy=by-ay, lenSq=dx*dx+dy*dy;
    if (lenSq===0) return Math.hypot(px-ax,py-ay);
    let t = ((px-ax)*dx+(py-ay)*dy)/lenSq;
    t = Math.max(0,Math.min(1,t));
    return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
}
function isRoadTile(tx, ty) {
    for (const [ai,bi] of ROAD_CONNECTIONS) {
        const ta=TOWNS[ai], tb=TOWNS[bi];
        if (distToSegment(tx,ty,ta.tileX,ta.tileY,tb.tileX,tb.tileY) < 1.8) return true;
    }
    return false;
}

// ── Monsters ──
const MonsterTypes = [
    // Tier 1 – Level 1+  Plains/Forest
    { id:'rat',       name:'Giant Rat',         biomes:['plains','forest'],          minLevel:1,  hp:28,  dmg:5,  speed:115, xp:10,  color:'#795548', size:13, behavior:'chase',   desc:'Fast but weak. Travels in packs. Loves Bert\'s cabbages.' },
    { id:'wisp',      name:"Will-o'-Wisp",      biomes:['plains','bog'],             minLevel:4,  hp:18,  dmg:7,  speed:170, xp:13,  color:'#80DEEA', size:9,  behavior:'erratic', desc:'Ghostly light. Confuses travellers into the bog.' },
    // Tier 2 – Level 3+
    { id:'bat',       name:'Vampire Bat',        biomes:['forest','bog','tundra'],    minLevel:3,  hp:22,  dmg:9,  speed:160, xp:18,  color:'#607D8B', size:11, behavior:'erratic', desc:'Swoops unpredictably. Carries minor diseases.' },
    { id:'mushroom',  name:'Fungal Creeper',     biomes:['forest','bog'],             minLevel:3,  hp:55,  dmg:10, speed:55,  xp:20,  color:'#AED581', size:22, behavior:'chase',   desc:'Slow tank. Spawns from damp soil.' },
    // Tier 3 – Level 5+
    { id:'slime',     name:'Toxic Slime',        biomes:['bog','plains'],             minLevel:5,  hp:65,  dmg:12, speed:60,  xp:25,  color:'#8BC34A', size:24, behavior:'chase',   desc:'Slow, high HP. Dissolves boots on contact.' },
    { id:'wolfkin',   name:'Forest Wolfkin',     biomes:['forest'],                  minLevel:5,  hp:50,  dmg:14, speed:145, xp:28,  color:'#8D6E63', size:17, behavior:'flank',   desc:'Pack hunter. Circles prey with unsettling confidence.' },
    { id:'scorpion',  name:'Sand Scorpion',      biomes:['desert'],                  minLevel:5,  hp:45,  dmg:16, speed:90,  xp:30,  color:'#d4a54a', size:20, behavior:'burrow',  desc:'Burrows and strikes from below. Very rude.' },
    // Tier 4 – Level 7+
    { id:'goblin',    name:'Goblin Rogue',       biomes:['ruins','forest'],           minLevel:7,  hp:50,  dmg:16, speed:130, xp:32,  color:'#4CAF50', size:18, behavior:'flank',   desc:'Cunning flanker. Member of the Goblin Freelancers Guild.' },
    { id:'wraith',    name:'Shadow Wraith',      biomes:['bog','ruins'],              minLevel:7,  hp:38,  dmg:20, speed:140, xp:38,  color:'#7E57C2', size:16, behavior:'erratic', desc:'Ethereal. Passes through walls. Very unpleasant company.' },
    // Tier 5 – Level 9+
    { id:'skeleton',  name:'Skeleton Archer',    biomes:['desert','ruins'],           minLevel:9,  hp:45,  dmg:12, speed:80,  xp:35,  color:'#E0E0E0', size:18, behavior:'ranged',  range:270, desc:'Member of Archers Union Local #47. Currently on strike.' },
    { id:'troll',     name:'Cave Troll',         biomes:['tundra','ruins'],           minLevel:9,  hp:140, dmg:22, speed:70,  xp:50,  color:'#78909C', size:30, behavior:'chase',   desc:'Massive brute. Guards ruins. Not a union member.' },
    { id:'icegolem',  name:'Ice Golem',          biomes:['tundra'],                  minLevel:10, hp:160, dmg:18, speed:50,  xp:55,  color:'#7eb8e8', size:32, behavior:'chase',   desc:'Slow. Freezing aura. Extremely bad vibes.' },
    // Tier 6 – Level 12+
    { id:'harpy',     name:'Harpy',              biomes:['volcanic','desert'],        minLevel:12, hp:60,  dmg:18, speed:180, xp:55,  color:'#F48FB1', size:17, behavior:'erratic', desc:'Swooping predator. Very dramatic.' },
    { id:'golem',     name:'Stone Golem',        biomes:['ruins'],                   minLevel:12, hp:200, dmg:28, speed:50,  xp:70,  color:'#90A4AE', size:36, behavior:'chase',   desc:'Near-invincible guardian of ancient things.' },
    // Tier 7 – Level 15+
    { id:'minotaur',  name:'Minotaur',           biomes:['tundra','ruins','volcanic'],minLevel:15, hp:160, dmg:32, speed:95,  xp:85,  color:'#BF360C', size:32, behavior:'charge',  desc:'Charges with devastating power. Does not accept apologies.' },
    { id:'medusa',    name:'Medusa',             biomes:['desert','ruins'],           minLevel:15, hp:80,  dmg:25, speed:85,  xp:90,  color:'#26C6DA', size:20, behavior:'ranged',  range:300, desc:'Petrifying gaze. Do NOT look at her. She knows.' },
    // Tier 8 – Level 18+
    { id:'hydra',     name:'Hydra',              biomes:['bog'],                     minLevel:18, hp:260, dmg:35, speed:65,  xp:120, color:'#2E7D32', size:38, behavior:'chase',   desc:'Multi-headed terror. Each head has a different complaint.' },
    { id:'elemental', name:'Fire Elemental',     biomes:['volcanic'],                minLevel:18, hp:120, dmg:30, speed:110, xp:100, color:'#ff4400', size:24, behavior:'erratic', desc:'Living fire. Leaves burns. Very enthusiastic about burning.' },
    // Bosses
    { id:'dragon',    name:'Lesser Dragon',      biomes:['volcanic','void'],         minLevel:1,  hp:400, dmg:35, speed:95,  xp:200, color:'#F44336', size:44, behavior:'flank',   isBoss:true, desc:'Ancient terror. Circles prey. Does not appreciate being called \'lesser\'.' },
    { id:'lich',      name:'The Lich',           biomes:['ruins','void'],            minLevel:1,  hp:320, dmg:28, speed:75,  xp:250, color:'#B39DDB', size:38, behavior:'ranged',  range:290, isBoss:true, desc:'Undead sorcerer. Personally offended by heroes.' },
    { id:'snorflaxia',name:'Grand Witch Snorflaxia',biomes:['void'],                 minLevel:1,  hp:2000,dmg:55, speed:80,  xp:5000,color:'#9c00ff', size:54, behavior:'ranged',  range:350, isBoss:true, desc:'The Chronically Disappointed. Final Boss. 200 years of waiting. Her patience: expired.' },
];

const BIOME_SPAWN_TABLES = {
    plains:   ['rat','bat','wisp'],
    forest:   ['wolfkin','mushroom','bat','rat'],
    desert:   ['scorpion','skeleton','medusa'],
    bog:      ['slime','wraith','hydra','mushroom','bat'],
    tundra:   ['icegolem','troll','minotaur','bat'],
    ruins:    ['goblin','skeleton','golem','wraith','troll'],
    volcanic: ['elemental','minotaur','harpy','dragon'],
    void:     ['lich','dragon','golem','elemental','snorflaxia'],
};

// ── Equipment ──
const ARMOR_ITEMS  = [
    { name:'Leather Armor', rarity:'common',   color:'#9e9e9e', damageReduction:0.10, slot:'armor' },
    { name:'Chain Mail',    rarity:'uncommon', color:'#4caf50', damageReduction:0.22, slot:'armor' },
    { name:'Plate Armor',   rarity:'rare',     color:'#5c9be8', damageReduction:0.38, slot:'armor' },
];
const RING_ITEMS   = [
    { name:'Iron Ring',     rarity:'common',   color:'#9e9e9e', damageMult:1.12, slot:'ring' },
    { name:'Silver Ring',   rarity:'uncommon', color:'#4caf50', damageMult:1.25, slot:'ring' },
    { name:'Gemstone Ring', rarity:'rare',     color:'#5c9be8', damageMult:1.40, slot:'ring' },
];
const SHIELD_ITEMS = [
    { name:'Wooden Shield', rarity:'common',   color:'#9e9e9e', blockDuration:1.0, cooldown:14, reflects:false, slot:'shield' },
    { name:'Iron Shield',   rarity:'uncommon', color:'#4caf50', blockDuration:1.2, cooldown:10, reflects:false, slot:'shield' },
    { name:'Runic Shield',  rarity:'rare',     color:'#5c9be8', blockDuration:1.5, cooldown:7,  reflects:true,  slot:'shield' },
];

const CHEST_SPAWN_DATA = [
    { x: 550, y:   0, loot:ARMOR_ITEMS[0]  }, { x:   0, y:-550, loot:RING_ITEMS[0]   },
    { x:1000, y: 900, loot:ARMOR_ITEMS[1]  }, { x:-900, y:1000, loot:RING_ITEMS[1]   },
    { x:1600, y:   0, loot:ARMOR_ITEMS[2]  }, { x:   0, y:1600, loot:RING_ITEMS[2]   },
    { x:-350, y: 350, loot:SHIELD_ITEMS[0] }, { x:-950, y:-500, loot:SHIELD_ITEMS[1] },
    { x: 700, y:-1400,loot:SHIELD_ITEMS[2] },
    // Town chests
    { x:(TOWNS[0].tileX-12)*TILE_SIZE, y:(TOWNS[0].tileY-3)*TILE_SIZE, loot:ARMOR_ITEMS[0]  },
    { x:(TOWNS[1].tileX+8)*TILE_SIZE,  y:(TOWNS[1].tileY-3)*TILE_SIZE, loot:ARMOR_ITEMS[1]  },
    { x:(TOWNS[2].tileX+7)*TILE_SIZE,  y:(TOWNS[2].tileY-2)*TILE_SIZE, loot:RING_ITEMS[1]   },
    { x:(TOWNS[3].tileX+8)*TILE_SIZE,  y:(TOWNS[3].tileY-6)*TILE_SIZE, loot:SHIELD_ITEMS[1] },
    { x:(TOWNS[4].tileX-14)*TILE_SIZE, y:(TOWNS[4].tileY-3)*TILE_SIZE, loot:ARMOR_ITEMS[2]  },
    { x:(TOWNS[4].tileX+8)*TILE_SIZE,  y:(TOWNS[4].tileY-7)*TILE_SIZE, loot:RING_ITEMS[2]   },
];

// § 5 ─ QUEST SYSTEM ──────────────────────────────────────────
const QUEST_DEFS = [
    { id:'pest_control',  title:'Pest Control',    desc:'Kill 15 Giant Rats for Bert.',   type:'kill_type',    target:'rat',      required:15, reward:{type:'maxHp',amount:25},  rewardText:'+25 Max HP' },
    { id:'explorer',      title:'Explorer',        desc:'Visit 3 towns.',                  type:'visit_towns',  required:3,        reward:{type:'xp',amount:600},     rewardText:'+600 XP' },
    { id:'treasure',      title:'Treasure Hunter', desc:'Open 5 treasure chests.',         type:'open_chests',  required:5,        reward:{type:'item',item:RING_ITEMS[1]},rewardText:'Silver Ring' },
    { id:'slayer',        title:'Monster Slayer',  desc:'Slay 50 monsters.',               type:'total_kills',  required:50,       reward:{type:'damage',amount:5},   rewardText:'+5 Damage' },
    { id:'biome_walker',  title:'Biome Walker',    desc:'Visit 4 different biomes.',       type:'visit_biomes', required:4,        reward:{type:'speed',amount:20},   rewardText:'+20 Speed' },
];

const questSystem = {
    quests:[], visitedBiomes:new Set(), visitedTownIds:new Set(), openedChests:0,

    init() {
        this.quests = QUEST_DEFS.map(d => ({ ...d, progress:0, completed:false }));
        this.visitedBiomes.clear();
        this.visitedTownIds.clear();
        this.openedChests = 0;
    },

    tick() {
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

// § 6 ─ CHUNK / TILE RENDERING ────────────────────────────────
const chunkCache = new Map();

function hasTreeAtTile(tx, ty) {
    if (Math.abs(tx) <= 5 && Math.abs(ty) <= 5) return false;
    for (const t of TOWNS) { if (Math.abs(tx-t.tileX)<22 && Math.abs(ty-t.tileY)<22) return false; }
    if (isRoadTile(tx, ty)) return false;
    const biome = getBiomeAtTile(tx, ty);
    return seededHash(tx*13+7, ty*19+3) < biome.treeChance;
}

function getTreeWorldPos(tx, ty) {
    const ox = (seededHash(tx*2+1, ty*3+1) - 0.5) * TILE_SIZE * 0.55;
    const oy = (seededHash(tx*5+3, ty*7+5) - 0.5) * TILE_SIZE * 0.55;
    return { x: tx*TILE_SIZE + TILE_SIZE/2 + ox, y: ty*TILE_SIZE + TILE_SIZE/2 + oy };
}

function getTreesNearPoint(cx, cy, radius) {
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

function renderTileToCtx(oc, sx, sy, tx, ty, biome) {
    const h = seededHash(tx*3+1, ty*7+2);
    oc.fillStyle = biome.tileColors[Math.floor(h * biome.tileColors.length)];
    oc.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);

    // Tile details
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
    // Subtle tile border
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
        // Shadow
        oc.fillStyle='rgba(0,0,0,0.18)'; oc.beginPath(); oc.ellipse(sx+3,sy+3,cR*0.9,cR*0.42,0,0,Math.PI*2); oc.fill();
        // Trunk
        oc.fillStyle='#5D4037'; oc.fillRect(sx-4,sy-tH,8,tH+4);
        // Canopy layers
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
    // Shadow
    oc.fillStyle='rgba(0,0,0,0.32)'; oc.fillRect(bx+5,by+5,bw,bh);
    // Exterior
    const wallColors = { house:['#7a6a55','#8a7a65'], inn:['#6a5040','#7a6050'], shop:['#7a5a30','#8a6a40'], townhall:['#888070','#9a9080'], tower:['#585868','#686878'] };
    const [wDark,wLight] = wallColors[type]||['#666','#777'];
    oc.fillStyle=wDark; oc.fillRect(bx,by,bw,bh);
    // Stone rows
    oc.fillStyle=wLight;
    for (let row=0; row<bh; row+=10) { oc.fillRect(bx+2,by+row+1,bw-4,6); }
    // Interior floor
    const wt=7;
    oc.fillStyle=type==='inn'?'#3c2a1a':type==='shop'?'#302820':'#382e24';
    oc.fillRect(bx+wt,by+wt,bw-wt*2,bh-wt*2);
    // Floor grid
    oc.strokeStyle='rgba(255,255,255,0.04)'; oc.lineWidth=0.5;
    for (let r=by+wt; r<by+bh-wt; r+=14) { oc.beginPath(); oc.moveTo(bx+wt,r); oc.lineTo(bx+bw-wt,r); oc.stroke(); }
    for (let c=bx+wt; c<bx+bw-wt; c+=14) { oc.beginPath(); oc.moveTo(c,by+wt); oc.lineTo(c,by+bh-wt); oc.stroke(); }
    // Windows
    oc.fillStyle='#ffe082';
    const numW = Math.max(1, Math.floor(bw/TILE_SIZE)-1);
    for (let i=0;i<numW;i++) {
        const wx = bx+wt+Math.floor((i+0.5)*(bw-wt*2)/numW)-4;
        oc.fillRect(wx,by+wt+2,8,6);
        oc.fillStyle='rgba(0,0,0,0.35)'; oc.fillRect(wx+3,by+wt+2,1.5,6); oc.fillRect(wx,by+wt+4,8,1);
        oc.fillStyle='#ffe082';
    }
    // Door
    const dw=10, dh=wt+2, dx=bx+bw/2-dw/2, dy=by+bh-dh;
    oc.fillStyle='#1a1205'; oc.fillRect(dx,dy,dw,dh+2);
    oc.fillStyle='#c8a050'; oc.fillRect(dx+dw-4,dy+3,2,4);
    // Border
    oc.strokeStyle='rgba(0,0,0,0.7)'; oc.lineWidth=2; oc.strokeRect(bx,by,bw,bh);
    // Label
    if (label) {
        oc.font='bold 9px Courier New';
        const tw=oc.measureText(label).width;
        oc.fillStyle='rgba(0,0,0,0.8)'; oc.fillRect(bx+bw/2-tw/2-3,by-16,tw+6,13);
        oc.fillStyle='#FFD700'; oc.textAlign='center'; oc.fillText(label,bx+bw/2,by-6); oc.textAlign='left';
    }
}

function getOrCreateChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (chunkCache.has(key)) return chunkCache.get(key);

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
    // 3. Trees (check slightly beyond chunk bounds to handle overhanging canopies)
    for (let ty=-2;ty<CHUNK_TILES+2;ty++) for (let tx=-2;tx<CHUNK_TILES+2;tx++) {
        const wx=cx*CHUNK_TILES+tx, wy=cy*CHUNK_TILES+ty;
        if (hasTreeAtTile(wx,wy)) {
            const pos = getTreeWorldPos(wx,wy);
            const biome = getBiomeAtTile(wx,wy);
            drawTreeToCtx(oc2, pos.x-cx*CHUNK_PX, pos.y-cy*CHUNK_PX, biome);
        }
    }
    // 4. Town buildings
    for (const town of TOWNS) {
        for (const b of town.buildings) {
            const bPX=(town.tileX+b.tx)*TILE_SIZE, bPY=(town.tileY+b.ty)*TILE_SIZE;
            const bW=b.tw*TILE_SIZE, bH=b.th*TILE_SIZE;
            const cpX=cx*CHUNK_PX, cpY=cy*CHUNK_PX;
            if (bPX+bW>=cpX && bPX<=cpX+CHUNK_PX && bPY+bH>=cpY && bPY<=cpY+CHUNK_PX)
                drawBuildingToCtx(oc2, bPX-cpX, bPY-cpY, bW, bH, b.type, b.label||'');
        }
    }

    if (chunkCache.size > 120) { const fk=chunkCache.keys().next().value; chunkCache.delete(fk); }
    chunkCache.set(key, oc);
    return oc;
}

function renderTerrain() {
    const cXmin=Math.floor(camera.x/CHUNK_PX)-1, cXmax=Math.ceil((camera.x+canvas.width)/CHUNK_PX)+1;
    const cYmin=Math.floor(camera.y/CHUNK_PX)-1, cYmax=Math.ceil((camera.y+canvas.height)/CHUNK_PX)+1;
    for (let cy=cYmin;cy<=cYmax;cy++) for (let cx=cXmin;cx<=cXmax;cx++) {
        const cc=getOrCreateChunk(cx,cy);
        ctx.drawImage(cc, cx*CHUNK_PX-camera.x, cy*CHUNK_PX-camera.y);
    }
}

// § 7 ─ ENTITY CLASSES ────────────────────────────────────────

// ── Player Class Data ──
const Classes = {
    human:  { name:'Human Knight',  color:'var(--accent-color)', size:24, baseHp:150, baseDmg:15, baseSpeed:185, attackCooldown:340, attackRange:42, rangedCooldown:1200, abilityName:'Block',    manaReq:0,  colorFill:'#A5D6A7', outline:'#2E7D32' },
    wizard: { name:'Arcane Wizard', color:'var(--wizard-color)', size:20, baseHp:80,  baseDmg:10, baseSpeed:162, attackCooldown:580, attackRange:32, rangedCooldown:2600, abilityName:'Fireball', manaReq:30, baseMana:100, manaRegen:6, colorFill:'#CE93D8', outline:'#6A1B9A' },
    beast:  { name:'Feral Beast',   color:'var(--beast-color)',  size:26, baseHp:120, baseDmg:20, baseSpeed:225, attackCooldown:195, attackRange:32, rangedCooldown:2000, abilityName:'Lifesteal',manaReq:0,  colorFill:'#FFCC80', outline:'#E65100' },
};

class Entity {
    constructor(x,y,size,color){ this.x=x; this.y=y; this.size=size; this.color=color; this.vx=0; this.vy=0; }
    draw() { ctx.fillStyle=this.color; ctx.fillRect(this.x-this.size/2-camera.x, this.y-this.size/2-camera.y, this.size, this.size); }
}

class Player extends Entity {
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
        // Handle ice slow
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
        // Tree collision
        resolveTreeCollision(this);
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
        projectiles.push(new Projectile(this.x,this.y,this.facingAngle,true,damage,type));
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
        enemies.forEach(enemy=>{
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
        archerTowers.forEach(tower=>{
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
            if (this.equipment.shield?.reflects) { enemies.forEach(e=>{ if(Math.hypot(e.x-this.x,e.y-this.y)<130)e.takeDamage(amount); }); showFloatingText(this.x,this.y-30,'REFLECTED!','#29b6f6'); }
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
        triggerLevelUpScreen();
    }

    drawPlayer() {
        const drawX=this.x-camera.x, drawY=this.y-camera.y;
        const bob=(this.vx!==0||this.vy!==0)?Math.sin(performance.now()/100)*2:0;
        // Shadow
        ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(drawX,drawY+this.size/2,this.size/1.5,this.size/4,0,0,Math.PI*2); ctx.fill();
        // Shield glow
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
            let wRot=this.isSwinging?bA+(-Math.PI/3+Math.min(1,(performance.now()-this.lastAttackTime)/150)*Math.PI*2/3):bA-Math.PI/6;
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
            let sRot=this.isSwinging?bA+(-Math.PI/3+Math.min(1,(performance.now()-this.lastAttackTime)/150)*Math.PI*2/3):bA-Math.PI/8;
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
            let cRot=this.isSwinging?bA+(-Math.PI/3+Math.min(1,(performance.now()-this.lastAttackTime)/150)*Math.PI*2/3):bA-Math.PI/6;
            ctx.rotate(cRot);
            ctx.fillStyle='#FFF8E1'; ctx.beginPath(); ctx.moveTo(-3,-8); ctx.lineTo(8,-20); ctx.lineTo(13,-14); ctx.fill();
            ctx.beginPath(); ctx.moveTo(2,-10); ctx.lineTo(14,-18); ctx.lineTo(17,-12); ctx.fill();
            ctx.restore();
        }
    }
}

// ── NPC Class ──
class NPC {
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
        const dx=this.x-camera.x, dy=this.y-camera.y;
        if (dx<-40||dx>canvas.width+40||dy<-40||dy>canvas.height+40) return;
        // Shadow
        ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(dx,dy+12,10,4,0,0,Math.PI*2); ctx.fill();
        // Legs
        ctx.fillStyle='#37474F'; ctx.fillRect(dx-5,dy+6,4,7); ctx.fillRect(dx+1,dy+6,4,7);
        // Body
        ctx.fillStyle=this.isMerchant?'#d4850a':'#1565C0'; ctx.fillRect(dx-7,dy-4,14,10);
        // Belt
        ctx.fillStyle=this.isMerchant?'#8a5200':'#0d3a6e'; ctx.fillRect(dx-7,dy+4,14,2);
        // Head
        ctx.fillStyle='#FFE0B2'; ctx.beginPath(); ctx.arc(dx,dy-9,7,0,Math.PI*2); ctx.fill();
        // Eyes
        ctx.fillStyle='#333'; ctx.fillRect(dx-3,dy-10,2,2); ctx.fillRect(dx+1,dy-10,2,2);
        // Hat / hair
        if (this.isMerchant) { ctx.fillStyle='#795548'; ctx.fillRect(dx-8,dy-16,16,5); ctx.fillRect(dx-5,dy-22,10,8); }
        else { ctx.fillStyle='#4e342e'; ctx.fillRect(dx-6,dy-15,12,5); }
        // Name label
        ctx.font='8px Courier New';
        const nw=ctx.measureText(this.name).width;
        ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(dx-nw/2-2,dy-28,nw+4,11);
        ctx.fillStyle=this.isMerchant?'#FFA000':'#90CAF9'; ctx.textAlign='center'; ctx.fillText(this.name,dx,dy-19); ctx.textAlign='left';
        // Nearby hint
        if (Math.hypot(player.x-this.x,player.y-this.y)<70) {
            ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='bold 10px Courier New'; ctx.textAlign='center'; ctx.fillText('[F] Talk',dx,dy-34); ctx.textAlign='left';
        }
    }
    interact() {
        const line=this.dialogue[this.dialogueIndex%this.dialogue.length]; this.dialogueIndex++;
        showNPCDialogue(this.name, line, this.isMerchant);
    }
}

// ── Enemy Class ──
class Enemy extends Entity {
    constructor(x,y,type) {
        super(x,y,type.size,type.color);
        this.typeId=type.id; this.name=type.name;
        const mult=1+Math.max(0,player.level-2)*0.10;
        const diffMult = (() => { const d=document.getElementById('difficulty-select')?.value||'normal'; return d==='easy'?0.75:d==='hard'?1.3:1.0; })();
        this.maxHp=Math.floor(type.hp*mult); this.hp=this.maxHp;
        this.damage=Math.floor(type.dmg*mult*diffMult);
        const earlyMult=Math.min(1.0,0.42+player.level*0.11);
        const diffSpeedMult = (() => { const d=document.getElementById('difficulty-select')?.value||'normal'; return d==='easy'?0.85:d==='hard'?1.15:1.0; })();
        this.speed=type.speed*(0.8+Math.random()*0.4)*earlyMult*diffSpeedMult;
        this.baseSpeed=this.speed; this.xpValue=Math.floor(type.xp*mult); this.behavior=type.behavior;
        this.range=type.range||0; this.isBoss=type.isBoss||false;
        this.lastAttackTime=0; this.aggroed=false;
        this.aggroRange=player.level<6?200+player.level*42:Infinity;
        this.attackState='approach'; this.attackStateTimer=0.4+Math.random()*0.8;
        this.strikeHit=false; this.meleeRange=this.size/2+26; this.stunTimer=0;
        this.knockbackVx=0; this.knockbackVy=0; this.angleOffset=Math.random()*Math.PI*2;
        // Special state
        this._chargeState='idle'; this._chargeTimer=5+Math.random()*4; this._chargeTarget=null;
        this._burrowState='surface'; this._burrowTimer=6+Math.random()*5;
        this.alpha=1;
    }

    update(dt) {
        if (this.alpha===0) return; // burrowed scorpion

        // Separation
        for (const other of enemies) {
            if (other===this) continue;
            const sx=this.x-other.x, sy=this.y-other.y, sd=Math.hypot(sx,sy);
            const minSep=(this.size+other.size)*0.9;
            if (sd<minSep&&sd>0){ const push=(minSep-sd)*0.5; this.x+=(sx/sd)*push; this.y+=(sy/sd)*push; }
        }
        // Shield repulsion
        if (player.shielding) {
            const sr=player.size*1.4+this.size*0.6;
            const pdx=this.x-player.x,pdy=this.y-player.y,pd=Math.hypot(pdx,pdy);
            if (pd<sr&&pd>0){ const push=(sr-pd)*1.1; this.x+=(pdx/pd)*push; this.y+=(pdy/pd)*push; }
            else if (pd===0){ this.x+=(Math.random()-0.5)*sr*2; this.y+=(Math.random()-0.5)*sr*2; }
        }

        const distP=Math.hypot(player.x-this.x,player.y-this.y);
        const angP=Math.atan2(player.y-this.y,player.x-this.x);

        // Knockback
        if (this.knockbackVx!==0||this.knockbackVy!==0) {
            this.x+=this.knockbackVx*dt; this.y+=this.knockbackVy*dt;
            const decay=Math.exp(-9*dt); this.knockbackVx*=decay; this.knockbackVy*=decay;
            if (Math.abs(this.knockbackVx)<1&&Math.abs(this.knockbackVy)<1){ this.knockbackVx=0; this.knockbackVy=0; }
        }

        // Special behavior overrides
        this._specialUpdate(dt, distP, angP);

        // Ranged
        if (this.behavior==='ranged') {
            this.speed=this.baseSpeed;
            let moveAng=angP;
            if (distP<this.range*0.65) moveAng=angP+Math.PI;
            else if (distP<=this.range) {
                this.speed=0;
                if (performance.now()-this.lastAttackTime>2000) {
                    projectiles.push(new Projectile(this.x,this.y,angP,false,this.damage,'fireball',this.name));
                    this.lastAttackTime=performance.now();
                }
                return;
            }
            this.x+=Math.cos(moveAng)*this.speed*dt; this.y+=Math.sin(moveAng)*this.speed*dt;
            return;
        }

        // Burrow behavior for scorpion
        if (this.behavior==='burrow') return;

        if (this.stunTimer>0){ this.stunTimer-=dt; return; }

        // State machine
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
        // Tree collision for enemies
        resolveTreeCollision(this);
    }

    _specialUpdate(dt, distP, angP) {
        switch(this.typeId) {
            case 'scorpion': {
                if (this._burrowState==='surface') {
                    this._burrowTimer-=dt;
                    if (this._burrowTimer<=0&&this.aggroed) {
                        this._burrowState='burrowing'; this._burrowTimer=1.2;
                        this.alpha=0; this.color='transparent';
                    } else if (distP>20) {
                        // Normal approach while surfaced
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
            case 'rat': {
                // Group aggro: nearby rats are awoken when one is hit
                break;
            }
        }
    }

    takeDamage(amount,isCrit=false) {
        this.hp-=amount;
        showFloatingText(this.x,this.y,Math.floor(amount),isCrit?'yellow':'white',isCrit);
        this.aggroed=true; this.stunTimer=0.30;
        if (this.attackState==='windup'||this.attackState==='strike'){ this.attackState='recoil'; this.attackStateTimer=0.36; this.strikeHit=false; }
        // Group aggro rats
        if (this.typeId==='rat') { enemies.forEach(e=>{ if(e.typeId==='rat'&&Math.hypot(e.x-this.x,e.y-this.y)<180){ e.aggroed=true; } }); }
        const kbP=1200/Math.sqrt(this.maxHp);
        const kbDx=this.x-player.x, kbDy=this.y-player.y, kbD=Math.hypot(kbDx,kbDy)||1;
        this.knockbackVx=(kbDx/kbD)*kbP; this.knockbackVy=(kbDy/kbD)*kbP;
        createParticles(this.x,this.y,this.color,3);
        if (this.hp<=0) {
            player.gainXp(this.xpValue); player.kills++;
            questSystem.onKill(this.typeId);
            if (this.isBoss){ showFloatingText(this.x,this.y-20,'BOSS DEFEATED!','gold'); player.heal(player.maxHp*0.5); }
            else if (Math.random()<0.10) { items.push({ x:this.x,y:this.y,size:10,heal:Math.max(10,Math.floor(player.maxHp*0.15)),life:12,bob:Math.random()*Math.PI*2 }); }
            // Ammo drop by biome
            if (Math.random()<0.12) {
                const biome=getBiomeAtWorld(this.x,this.y);
                const ammoType = biome.id==='desert'||biome.id==='ruins' ? 'rock' : 'arrow';
                items.push({ x:this.x+10,y:this.y,size:8,ammoType,ammoCount:2+Math.floor(Math.random()*3),life:15,bob:Math.random()*Math.PI*2 });
            }
            createParticles(this.x,this.y,this.color,10);
            return true;
        }
        return false;
    }

    draw() {
        if (this.alpha===0) return;
        const drawX=this.x-camera.x, drawY=this.y-camera.y, s=this.size;
        if (drawX<-s*3||drawX>canvas.width+s*3||drawY<-s*3||drawY>canvas.height+s*3) return;

        if (this.attackState==='windup'||this._chargeState==='windup') {
            ctx.save(); ctx.globalAlpha=0.22+Math.sin(Date.now()/75)*0.1; ctx.fillStyle='#ff6d00';
            ctx.beginPath(); ctx.arc(drawX,drawY,s*1.2,0,Math.PI*2); ctx.fill(); ctx.restore();
        }
        // HP bar
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

// ── Projectile ──
class Projectile {
    constructor(x,y,angle,isPlayer,damage,type='fireball',shooterName=null) {
        this.x=x; this.y=y; this.angle=angle; this.isPlayer=isPlayer; this.damage=damage;
        this.type=type; this.shooterName=shooterName;
        this.speed=type==='arrow'?525:(type==='rock'?325:405);
        this.size=type==='arrow'?5:(type==='rock'?9:6);
        this.color=!isPlayer?'#FF5722':(type==='arrow'?'#FFD700':(type==='rock'?'#A1887F':'#00BCD4'));
        this.life=type==='rock'?1.0:1.5;
    }
    update(dt) {
        this.x+=Math.cos(this.angle)*this.speed*dt; this.y+=Math.sin(this.angle)*this.speed*dt; this.life-=dt;
        if (this.isPlayer) {
            for (let i=0;i<enemies.length;i++) { const e=enemies[i]; if(Math.hypot(e.x-this.x,e.y-this.y)<e.size/2+this.size){ e.takeDamage(this.damage); createParticles(this.x,this.y,this.color,5); return true; } }
            for (let i=0;i<archerTowers.length;i++) { const t=archerTowers[i]; if(Math.hypot(t.x-this.x,t.y-this.y)<t.tw/2+this.size+6){ t.takeDamage(this.damage); createParticles(this.x,this.y,this.color,5); return true; } }
        } else {
            if (Math.hypot(player.x-this.x,player.y-this.y)<player.size/2+this.size){ player.takeDamage(this.damage,this.shooterName); createParticles(this.x,this.y,this.color,5); return true; }
        }
        return this.life<=0;
    }
    draw() {
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

// ── Archer Tower ──
class ArcherTower {
    constructor(x,y) {
        this.x=x; this.y=y; this.tw=28; this.th=52;
        this.maxHp=180+player.level*22; this.hp=this.maxHp;
        this.lastShotTime=0; this.shotCooldown=2600; this.range=320;
        this.damage=10+player.level*2; this.dead=false; this.name='Archer Tower';
        this.shootAnim=0;
    }
    update(dt) {
        if (this.shootAnim>0) this.shootAnim-=dt;
        const dist=Math.hypot(player.x-this.x,player.y-this.y);
        if (dist>this.range) return;
        const now=performance.now();
        if (now-this.lastShotTime<this.shotCooldown) return;
        const ang=Math.atan2(player.y-this.y,player.x-this.x);
        projectiles.push(new Projectile(this.x,this.y,ang,false,this.damage,'arrow',this.name));
        this.lastShotTime=now; this.shootAnim=0.25;
    }
    takeDamage(amount,isCrit=false) {
        this.hp-=amount; showFloatingText(this.x,this.y,Math.floor(amount),isCrit?'yellow':'white',isCrit);
        createParticles(this.x,this.y,'#78909C',3);
        if (this.hp<=0) {
            this.dead=true;
            chests.push({ x:this.x,y:this.y,opened:false, loot:Math.random()<0.5?ARMOR_ITEMS[1]:RING_ITEMS[1] });
            showFloatingText(this.x,this.y-20,'Tower Destroyed!','#FFA726');
        }
    }
    draw() {
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

// ── Particles & Floats ──
function createParticles(x,y,color,count) {
    for(let i=0;i<count;i++) {
        particles.push({ x,y,vx:(Math.random()-0.5)*180,vy:(Math.random()-0.5)*180,size:Math.random()*4+2,color,life:0.4+Math.random()*0.3 });
    }
}
function showFloatingText(x,y,text,color='white',isCrit=false) {
    floatTexts.push({ x,y,text:String(text),color,isCrit,life:1.2,maxLife:1.2 });
}

function resolveTreeCollision(entity) {
    const trees = getTreesNearPoint(entity.x, entity.y, TREE_COLL_R+entity.size/2+12);
    for (const tree of trees) {
        const dist=Math.hypot(entity.x-tree.x,entity.y-tree.y);
        const minD=TREE_COLL_R+entity.size/2+3;
        if (dist<minD&&dist>0){ const push=(minD-dist)+1; entity.x+=(entity.x-tree.x)/dist*push; entity.y+=(entity.y-tree.y)/dist*push; }
    }
}

// § 8 ─ SPAWN MANAGER ─────────────────────────────────────────
const spawnManager = {
    spawnTimer:0, lastBossLevel:0, bossSpawned:false,

    update(dt) {
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
        const diff=document.getElementById('difficulty-select')?.value||'normal';
        const maxE=diff==='easy'?Math.min(14,3+Math.floor(player.level*0.8)):(diff==='hard'?Math.min(65,6+player.level*3):Math.min(45,4+player.level*2));
        if (enemies.length>=maxE) return;

        const biome=getBiomeAtWorld(player.x,player.y);
        const table=BIOME_SPAWN_TABLES[biome.id]||BIOME_SPAWN_TABLES['plains'];
        const available=MonsterTypes.filter(m=>!m.isBoss&&player.level>=m.minLevel&&table.includes(m.id));
        const fallback=MonsterTypes.filter(m=>!m.isBoss&&player.level>=m.minLevel);
        const pool=(available.length>0?available:fallback);
        if (!pool.length) return;

        // Weighted selection: recent unlocks preferred
        let wPool=[];
        for (const m of pool) {
            const above=player.level-m.minLevel;
            const w=above<=2?(0.3+above*0.35):Math.max(0.05,1.0-(above-2)*0.08);
            wPool.push({type:m,weight:w});
        }
        const total=wPool.reduce((s,e)=>s+e.weight,0);
        let r=Math.random()*total; let chosen=wPool[0].type;
        for (const e of wPool){ r-=e.weight; if(r<=0){chosen=e.type;break;} }

        // Spawn outside view
        const a=Math.random()*Math.PI*2;
        const dist=Math.max(canvas.width,canvas.height)/2+120;
        const x=player.x+Math.cos(a)*dist, y=player.y+Math.sin(a)*dist;
        enemies.push(new Enemy(x,y,chosen));
    },

    spawnBoss() {
        const a=Math.random()*Math.PI*2;
        const x=player.x+Math.cos(a)*330, y=player.y+Math.sin(a)*330;
        const bosses=MonsterTypes.filter(m=>m.isBoss);
        const btype=bosses[Math.floor(Math.random()*bosses.length)];
        const boss=new Enemy(x,y,btype);
        boss.maxHp*=(1+player.level*0.1); boss.hp=boss.maxHp;
        enemies.push(boss);
    }
};

// § 9 ─ UI SYSTEMS ────────────────────────────────────────────

// ── Minimap ──
const minimapCanvas=document.getElementById('minimapCanvas');
const minimapCtx=minimapCanvas.getContext('2d');
let minimapFrame=0;

function renderMinimap() {
    minimapFrame++;
    if (minimapFrame%30!==0) return; // Update every 30 frames (~2x/sec)
    const mw=160, mh=120, WPP=30; // world pixels per minimap pixel
    minimapCtx.fillStyle='#0a0a10'; minimapCtx.fillRect(0,0,mw,mh);
    const sc=3; // draw 3×3 block per sample
    for (let my=0;my<mh;my+=sc) for (let mx=0;mx<mw;mx+=sc) {
        const wx=player.x+(mx-mw/2)*WPP, wy=player.y+(my-mh/2)*WPP;
        minimapCtx.fillStyle=getBiomeAtWorld(wx,wy).minimapColor;
        minimapCtx.fillRect(mx,my,sc,sc);
    }
    // Roads
    for (const [ai,bi] of ROAD_CONNECTIONS) {
        const ta=TOWNS[ai], tb=TOWNS[bi];
        const ax=mw/2+(ta.tileX*TILE_SIZE-player.x)/WPP, ay=mh/2+(ta.tileY*TILE_SIZE-player.y)/WPP;
        const bx=mw/2+(tb.tileX*TILE_SIZE-player.x)/WPP, by=mh/2+(tb.tileY*TILE_SIZE-player.y)/WPP;
        minimapCtx.strokeStyle='rgba(160,130,80,0.45)'; minimapCtx.lineWidth=1.5;
        minimapCtx.beginPath(); minimapCtx.moveTo(ax,ay); minimapCtx.lineTo(bx,by); minimapCtx.stroke();
    }
    // Towns
    for (const town of TOWNS) {
        const tx=mw/2+(town.tileX*TILE_SIZE-player.x)/WPP, ty=mh/2+(town.tileY*TILE_SIZE-player.y)/WPP;
        if (tx>=0&&tx<mw&&ty>=0&&ty<mh) {
            minimapCtx.fillStyle='#FFD700'; minimapCtx.fillRect(tx-3,ty-3,6,6);
            minimapCtx.font='7px Courier New'; minimapCtx.fillStyle='#FFD700'; minimapCtx.textAlign='center'; minimapCtx.fillText(town.name.slice(0,3),tx,ty-5); minimapCtx.textAlign='left';
        }
    }
    // Enemies
    for (const e of enemies) {
        const ex=mw/2+(e.x-player.x)/WPP, ey=mh/2+(e.y-player.y)/WPP;
        if (ex>=0&&ex<mw&&ey>=0&&ey<mh){ minimapCtx.fillStyle=e.isBoss?'#ff0':e.color; minimapCtx.fillRect(ex-1,ey-1,2,2); }
    }
    // Player
    minimapCtx.fillStyle='#fff'; minimapCtx.fillRect(mw/2-3,mh/2-3,6,6);
    minimapCtx.strokeStyle='rgba(255,255,255,0.15)'; minimapCtx.lineWidth=1; minimapCtx.strokeRect(0,0,mw,mh);
}

// ── Town Tracking ──
let _lastTownId = null;
function checkTownProximity() {
    for (const town of TOWNS) {
        const dist=Math.hypot(player.x-town.tileX*TILE_SIZE, player.y-town.tileY*TILE_SIZE);
        if (dist<TOWN_RADIUS) {
            questSystem.onVisitTown(town.id);
            if (_lastTownId!==town.id) {
                _lastTownId=town.id;
                showTownFlash(town);
                // Update biome display to show town name
                document.getElementById('biome-name-display').style.color='#FFD700';
                document.getElementById('biome-name-display').textContent=town.name;
            }
            return;
        }
    }
    _lastTownId=null;
}

let _townFlashTimeout=null;
function showTownFlash(town) {
    const el=document.getElementById('town-flash');
    document.getElementById('town-flash-name').textContent=town.name.toUpperCase();
    document.getElementById('town-flash-subtitle').textContent=town.subtitle;
    el.classList.remove('hidden'); el.classList.add('visible');
    if (_townFlashTimeout) clearTimeout(_townFlashTimeout);
    _townFlashTimeout=setTimeout(()=>{ el.classList.remove('visible'); setTimeout(()=>el.classList.add('hidden'),600); },3500);
}

// ── NPC Dialogue ──
function showNPCDialogue(name, text, isMerchant) {
    currentState=GameState.PAUSED;
    document.getElementById('npc-dialog-name').textContent=(isMerchant?'[Merchant] ':'')+(name);
    document.getElementById('npc-dialog-text').textContent=text;
    document.getElementById('npc-dialog').classList.remove('hidden');
}
function closeNPCDialogue() {
    document.getElementById('npc-dialog').classList.add('hidden');
    currentState=GameState.PLAYING;
    lastTime=performance.now();
}

// ── Biome display update ──
let _lastBiomeId='';
function updateBiomeDisplay() {
    const biome=getBiomeAtWorld(player.x,player.y);
    questSystem.onVisitBiome(biome.id);
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

// ── Quest Tracker ──
function updateQuestTracker() {
    const el=document.getElementById('quest-list'); if(!el) return;
    el.innerHTML='';
    for (const q of questSystem.quests.slice(0,5)) {
        const div=document.createElement('div'); div.className='quest-item';
        const pct=Math.min(1,q.progress/q.required);
        div.innerHTML=`<div class="quest-title-row${q.completed?' done':''}"><span>${q.title}</span><span>${q.completed?'&#10003;':q.progress+'/'+q.required}</span></div>${q.completed?'':'<div class="quest-prog-bar"><div class="quest-prog-fill" style="width:${Math.round(pct*100)}%"></div></div>'}`;
        el.appendChild(div);
    }
}

// ── HUD Update ──
function updateHUD() {
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
    // Equipment
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
    document.getElementById('stat-ability-label').title=`${Classes[player.classType==='knight'?'human':player.classType]?.abilityName||'Power'}`;
}

// § 10 ─ GAME LOOP ─────────────────────────────────────────────
let enemies=[], projectiles=[], particles=[], floatTexts=[], items=[], chests=[], archerTowers=[], npcs=[];
const spawnedTowerKeys=new Set();
let ammoSpawnTimer=5;

function gameLoop(timestamp) {
    const dt=Math.min((timestamp-lastTime)/1000, 0.1);
    lastTime=timestamp;

    if (currentState===GameState.PLAYING) {
        // ── UPDATE ──
        player.update(dt);
        spawnManager.update(dt);
        questSystem.tick();
        checkTownProximity();
        updateBiomeDisplay();

        // Ammo drops
        ammoSpawnTimer-=dt;
        if (ammoSpawnTimer<=0) {
            const a=Math.random()*Math.PI*2, d=200+Math.random()*300;
            const biome=getBiomeAtWorld(player.x,player.y);
            const ammoType=biome.id==='desert'||biome.id==='ruins'?'rock':'arrow';
            items.push({ x:player.x+Math.cos(a)*d, y:player.y+Math.sin(a)*d, size:8, ammoType, ammoCount:3+Math.floor(Math.random()*4), life:20, bob:Math.random()*Math.PI*2 });
            ammoSpawnTimer=5+Math.random()*5;
        }

        // Update enemies
        for (let i=enemies.length-1;i>=0;i--) {
            enemies[i].update(dt);
            if (enemies[i].hp<=0) enemies.splice(i,1);
        }
        // Update projectiles
        for (let i=projectiles.length-1;i>=0;i--) { if(projectiles[i].update(dt)) projectiles.splice(i,1); }
        // Update NPC
        for (const n of npcs) n.update(dt);
        // Update archer towers
        for (let i=archerTowers.length-1;i>=0;i--) { archerTowers[i].update(dt); if(archerTowers[i].dead) archerTowers.splice(i,1); }

        // Items collection (health orbs + ammo)
        for (let i=items.length-1;i>=0;i--) {
            const item=items[i]; item.life-=dt; item.bob+=dt*3;
            if (item.life<=0){ items.splice(i,1); continue; }
            const dist=Math.hypot(player.x-item.x,player.y-item.y);
            if (dist<28) {
                if (item.heal) player.heal(item.heal);
                else if (item.ammoType) {
                    if(item.ammoType==='arrow') player.arrows+=item.ammoCount;
                    else player.rocks+=item.ammoCount;
                    showFloatingText(item.x,item.y-10,`+${item.ammoCount} ${item.ammoType==='arrow'?'Arrows':'Rocks'}`,'#FFD700');
                    updateHUD();
                }
                items.splice(i,1);
            }
        }

        // Chest collection
        for (const chest of chests) {
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
                updateQuestTracker();
            }
        }

        // Archer Tower spawn near towns when player approaches
        for (const town of TOWNS) {
            if (Math.hypot(player.x-town.tileX*TILE_SIZE,player.y-town.tileY*TILE_SIZE)<600) {
                const key=`tower_${town.id}`;
                if (!spawnedTowerKeys.has(key)) {
                    spawnedTowerKeys.add(key);
                    const tx=(town.tileX+12)*TILE_SIZE, ty=(town.tileY-8)*TILE_SIZE;
                    archerTowers.push(new ArcherTower(tx,ty));
                    const tx2=(town.tileX-12)*TILE_SIZE, ty2=(town.tileY+6)*TILE_SIZE;
                    archerTowers.push(new ArcherTower(tx2,ty2));
                }
            }
        }

        // F key NPC interaction
        if (keys['f']||keys['F']) {
            keys['f']=false; keys['F']=false;
            for (const n of npcs) {
                if (Math.hypot(player.x-n.x,player.y-n.y)<70) { n.interact(); break; }
            }
        }
    }

    // ── RENDER ──
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Terrain (pre-rendered chunks)
    renderTerrain();

    // Biome atmospheric overlay
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

    if (currentState!==GameState.MENU) {
        // Items
        for (const item of items) {
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

        // Chests
        for (const chest of chests) {
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

        // Archer towers
        for (const t of archerTowers) t.draw();

        // NPCs
        for (const n of npcs) n.draw();

        // Enemies
        for (const e of enemies) e.draw();

        // Player
        player.drawPlayer();

        // Projectiles
        for (const p of projectiles) p.draw();

        // Particles
        for (let i=particles.length-1;i>=0;i--) {
            const p=particles[i]; p.x+=p.vx*0.016; p.y+=p.vy*0.016; p.life-=0.016;
            if (p.life<=0){ particles.splice(i,1); continue; }
            ctx.fillStyle=p.color; ctx.globalAlpha=p.life*2.5; ctx.fillRect(p.x-camera.x,p.y-camera.y,p.size,p.size); ctx.globalAlpha=1;
        }

        // Floating texts
        for (let i=floatTexts.length-1;i>=0;i--) {
            const ft=floatTexts[i]; ft.y-=28*(1/60); ft.life-=(1/60);
            if (ft.life<=0){ floatTexts.splice(i,1); continue; }
            ctx.fillStyle=ft.color; ctx.font=ft.isCrit?'bold 26px Courier New':'bold 16px Courier New';
            ctx.globalAlpha=ft.life/ft.maxLife; const mw2=ctx.measureText(ft.text).width;
            ctx.fillText(ft.text,ft.x-camera.x-mw2/2,ft.y-camera.y); ctx.globalAlpha=1;
        }

        // Minimap
        renderMinimap();
    }

    if (currentState!==GameState.MENU) animationFrameId=requestAnimationFrame(gameLoop);
}

// § 11 ─ GAME FUNCTIONS ────────────────────────────────────────
function startGame(className, loadedData=null) {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('mobile-controls').classList.remove('hidden');
    document.getElementById('action-btn').classList.remove('hidden');
    document.getElementById('ranged-btn').classList.remove('hidden');
    document.getElementById('minimap-wrap').classList.remove('hidden');

    if (loadedData) {
        player=new Player(Classes[loadedData.classType]);
        Object.assign(player,loadedData.player);
    } else {
        player=new Player(Classes[className]);
    }

    // Ability label
    document.getElementById('ability-upgrade-btn').innerText=`+ Improve ${Classes[player.classType==='wizard'?'wizard':(player.classType==='knight'?'human':'beast')].abilityName}`;

    // Spawn NPCs from towns
    npcs=[];
    for (const town of TOWNS) {
        for (const npcData of town.npcs) {
            const wx=(town.tileX+npcData.tx)*TILE_SIZE;
            const wy=(town.tileY+npcData.ty)*TILE_SIZE;
            npcs.push(new NPC(wx,wy,npcData));
        }
    }

    enemies=[]; projectiles=[]; particles=[]; items=[]; floatTexts=[];
    chests=CHEST_SPAWN_DATA.map(pos=>({x:pos.x,y:pos.y,opened:false,loot:pos.loot}));
    archerTowers=[]; spawnedTowerKeys.clear();
    spawnManager.spawnTimer=0; spawnManager.lastBossLevel=0; spawnManager.bossSpawned=false;
    ammoSpawnTimer=5;
    questSystem.init();
    _lastBiomeId=''; _lastTownId=null;
    chunkCache.clear(); _biomeCache.clear();
    updateHUD(); updateQuestTracker();
    currentState=GameState.PLAYING;
    lastTime=performance.now();
    cancelAnimationFrame(animationFrameId);
    gameLoop(performance.now());

    // Welcome message
    setTimeout(()=>{ showFloatingText(player.x,player.y-100,'Welcome to Grumbleshire!','#FFD700'); },800);
}

function pauseGame() {
    currentState=GameState.PAUSED;
    document.getElementById('pause-menu').classList.remove('hidden');
    document.getElementById('save-msg').innerText='';
}

function resumeGame() {
    currentState=GameState.PLAYING;
    document.getElementById('pause-menu').classList.add('hidden');
    lastTime=performance.now();
    cancelAnimationFrame(animationFrameId);
    gameLoop(performance.now());
}

function triggerLevelUpScreen() {
    currentState=GameState.LEVEL_UP;
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

const DEATH_QUOTES = [
    '"Perhaps next time wear better boots."',
    '"The Seer predicted this. Gerald the Frog also predicted this."',
    '"A bold strategy. It did not work."',
    '"Snorflaxia sends her regards. Well, not really. She has no idea who you are."',
    '"Seven out of ten. We\ll say seven out of ten effort."',
    '"The cabbages remain unguarded."',
];

function gameOver(killerName=null) {
    currentState=GameState.GAME_OVER;
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

function returnToMenu() {
    currentState=GameState.MENU;
    cancelAnimationFrame(animationFrameId);
    ['pause-menu','game-over-screen','hud','mobile-controls','action-btn','ranged-btn','minimap-wrap','town-flash'].forEach(id=>{
        document.getElementById(id)?.classList.add('hidden');
    });
    document.getElementById('start-screen').classList.remove('hidden');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#0a0a0f'; ctx.fillRect(0,0,canvas.width,canvas.height);
}

// § 12 ─ SAVE / LOAD ──────────────────────────────────────────
function saveGame() {
    const data = {
        player:{ level:player.level,xp:player.xp,xpToNext:player.xpToNext,score:player.score,kills:player.kills,maxHp:player.maxHp,hp:player.hp,damage:player.damage,speed:player.speed,abilityPower:player.abilityPower,arrows:player.arrows,rocks:player.rocks,equipment:player.equipment },
        classType:player.classType==='knight'?'human':player.classType,
        timestamp:new Date().toISOString()
    };
    try { localStorage.setItem('endlessChronicles_save',JSON.stringify(data)); document.getElementById('save-msg').innerText='Game Saved!'; document.getElementById('save-msg').className='mt-4 text-sm text-green-400 h-4'; document.getElementById('load-save-btn').classList.remove('hidden'); }
    catch(e) { document.getElementById('save-msg').innerText='Save Failed.'; }
}
function checkSaveGame() { return !!localStorage.getItem('endlessChronicles_save'); }
function loadGame() {
    try { const raw=localStorage.getItem('endlessChronicles_save'); if(raw) startGame(null,JSON.parse(raw)); }
    catch(e) { console.error('Load error:',e); }
}
function deleteSaveGame() { localStorage.removeItem('endlessChronicles_save'); }

// § 13 ─ INPUT & EVENTS ───────────────────────────────────────
document.addEventListener('keydown',(e)=>{
    const k=e.key.length===1?e.key.toLowerCase():e.key; keys[k]=true;
    if (e.key==='Escape') {
        if (currentState===GameState.PLAYING) pauseGame();
        else if (currentState===GameState.PAUSED) { document.getElementById('npc-dialog').classList.contains('hidden')?resumeGame():closeNPCDialogue(); }
    }
    if (e.key===' '&&currentState===GameState.PLAYING){ e.preventDefault(); player.attack(); }
    if ((e.key==='e'||e.key==='E')&&currentState===GameState.PLAYING){ e.preventDefault(); player.rangedAttack(); }
    if (e.key==='Shift'&&currentState===GameState.PLAYING){ e.preventDefault(); player.activateShield(); }
    if ((e.key==='f'||e.key==='F')&&currentState===GameState.PLAYING){ e.preventDefault(); /* handled in game loop */ }
    if ((e.key==='f'||e.key==='F')&&currentState===GameState.PAUSED&&!document.getElementById('npc-dialog').classList.contains('hidden')) closeNPCDialogue();
});
document.addEventListener('keyup',(e)=>{ const k=e.key.length===1?e.key.toLowerCase():e.key; keys[k]=false; });
window.addEventListener('blur',()=>{ for(const k in keys) keys[k]=false; });
document.addEventListener('contextmenu',(e)=>{ if(currentState!==GameState.MENU) e.preventDefault(); });
canvas.addEventListener('mousedown',(e)=>{
    if (currentState!==GameState.PLAYING) return;
    if (e.button===0) player.attack();
    if (e.button===2) player.rangedAttack();
});

// Mobile buttons
const setupMobileBtn=(id,key)=>{
    const btn=document.getElementById(id); if(!btn) return;
    btn.addEventListener('touchstart',(e)=>{e.preventDefault();keys[key]=true;});
    btn.addEventListener('touchend',(e)=>{e.preventDefault();keys[key]=false;});
    btn.addEventListener('mousedown',(e)=>{e.preventDefault();keys[key]=true;});
    btn.addEventListener('mouseup',(e)=>{e.preventDefault();keys[key]=false;});
    btn.addEventListener('mouseleave',()=>keys[key]=false);
};
setupMobileBtn('btn-up','w'); setupMobileBtn('btn-down','s'); setupMobileBtn('btn-left','a'); setupMobileBtn('btn-right','d');
document.getElementById('action-btn').addEventListener('touchstart',(e)=>{e.preventDefault();if(currentState===GameState.PLAYING)player.attack();});
document.getElementById('action-btn').addEventListener('mousedown',()=>{if(currentState===GameState.PLAYING)player.attack();});
document.getElementById('ranged-btn').addEventListener('touchstart',(e)=>{e.preventDefault();if(currentState===GameState.PLAYING)player.rangedAttack();});
document.getElementById('ranged-btn').addEventListener('mousedown',()=>{if(currentState===GameState.PLAYING)player.rangedAttack();});

// ── UI Buttons ──
document.getElementById('menu-btn').addEventListener('click',pauseGame);
document.getElementById('resume-btn').addEventListener('click',resumeGame);
document.getElementById('save-btn').addEventListener('click',saveGame);
document.getElementById('quit-btn').addEventListener('click',returnToMenu);
document.getElementById('restart-btn').addEventListener('click',returnToMenu);
document.getElementById('npc-dialog-close').addEventListener('click',closeNPCDialogue);

// Bestiary
const showBestiary=()=>document.getElementById('bestiary-screen').classList.remove('hidden');
const hideBestiary=()=>document.getElementById('bestiary-screen').classList.add('hidden');
document.getElementById('show-bestiary-btn').addEventListener('click',showBestiary);
document.getElementById('menu-bestiary-btn').addEventListener('click',showBestiary);
document.getElementById('close-bestiary-btn').addEventListener('click',hideBestiary);

// Lore screen
document.getElementById('show-lore-btn').addEventListener('click',()=>document.getElementById('lore-screen').classList.remove('hidden'));
document.getElementById('close-lore-btn').addEventListener('click',()=>document.getElementById('lore-screen').classList.add('hidden'));

// Level Up
document.querySelectorAll('.upgrade-btn').forEach(btn=>{
    btn.addEventListener('click',(e)=>{
        const stat=e.target.dataset.stat;
        if (stat==='maxHp'){player.maxHp+=25;player.hp+=25;}
        else if (stat==='damage') player.damage+=5;
        else if (stat==='speed') player.speed+=10;
        else if (stat==='ability'){
            if(player.classType==='wizard'){player.maxMana+=30;player.mana+=30;player.manaRegen+=2;}
            else if(player.classType==='knight') player.abilityPower+=0.2;
            else player.abilityPower+=0.5;
        }
        updateHUD();
        document.getElementById('level-up-screen').classList.add('hidden');
        setTimeout(()=>{ lastTime=performance.now(); currentState=GameState.PLAYING; cancelAnimationFrame(animationFrameId); gameLoop(performance.now()); },100);
    });
});

// Class Cards
let selectedClass=null;
document.querySelectorAll('.class-card').forEach(card=>{
    card.addEventListener('click',()=>{
        document.querySelectorAll('.class-card').forEach(c=>c.style.borderColor='var(--border-color)');
        const type=card.dataset.class;
        card.style.borderColor=type==='human'?'var(--accent-color)':type==='wizard'?'var(--wizard-color)':'var(--beast-color)';
        selectedClass=type;
        document.getElementById('start-new-btn').classList.remove('hidden');
    });
});
document.getElementById('start-new-btn').addEventListener('click',()=>{ if(selectedClass) startGame(selectedClass); });
document.getElementById('load-save-btn').addEventListener('click',loadGame);

// § BESTIARY POPULATE ─────────────────────────────────────────
function buildBestiary() {
    const tbody=document.getElementById('bestiary-body'); if(!tbody) return;
    tbody.innerHTML='';
    MonsterTypes.forEach(m=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td style="color:${m.color};font-weight:bold">${m.isBoss?'[BOSS] ':''}${m.name}</td><td class="text-xs" style="color:#aaa">${m.biomes.join(', ')}</td><td>${m.speed>135?'Fast':(m.speed<75?'Slow':'Normal')}</td><td>${m.dmg>25?'High':m.dmg>12?'Med':'Low'}</td><td class="text-xs text-gray-400">${m.desc}</td>`;
        tbody.appendChild(tr);
    });
}
buildBestiary();

// § CLASS PREVIEWS ────────────────────────────────────────────
(function drawClassPreviews(){
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
})();

// § INIT ──────────────────────────────────────────────────────
document.getElementById('class-selection').classList.remove('hidden');
if (checkSaveGame()) document.getElementById('load-save-btn').classList.remove('hidden');

// Initial menu background
ctx.fillStyle='#0a0a0f'; ctx.fillRect(0,0,canvas.width,canvas.height);
// Draw a preview of the starting plains biome in the background
(function drawMenuBg(){
    // Render a static view of the world around origin for the menu
    for (let cy=-2;cy<=3;cy++) for (let cx=-2;cx<=3;cx++) {
        const cc=getOrCreateChunk(cx,cy);
        ctx.globalAlpha=0.35;
        ctx.drawImage(cc, cx*CHUNK_PX-canvas.width*0.5+canvas.width/2, cy*CHUNK_PX-canvas.height*0.5+canvas.height/2);
        ctx.globalAlpha=1;
    }
    ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(0,0,canvas.width,canvas.height);
})();
