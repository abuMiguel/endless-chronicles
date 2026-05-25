// ============================================================
// WORLD DATA  ─  static-ish definitions:
//   • Towns, road graph
//   • MonsterTypes + biome spawn tables
//   • Equipment items
//   • Initial chest spawn data
// ============================================================
'use strict';
import { TILE_SIZE } from './state.js';

// ── Towns ────────────────────────────────────────────────────
export const TOWNS = [
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
    },
];
export const ROAD_CONNECTIONS = [[0,1],[0,2],[0,3],[0,4]];

export function distToSegment(px, py, ax, ay, bx, by) {
    const dx=bx-ax, dy=by-ay, lenSq=dx*dx+dy*dy;
    if (lenSq===0) return Math.hypot(px-ax,py-ay);
    let t = ((px-ax)*dx+(py-ay)*dy)/lenSq;
    t = Math.max(0,Math.min(1,t));
    return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
}
export function isRoadTile(tx, ty) {
    for (const [ai,bi] of ROAD_CONNECTIONS) {
        const ta=TOWNS[ai], tb=TOWNS[bi];
        if (distToSegment(tx,ty,ta.tileX,ta.tileY,tb.tileX,tb.tileY) < 1.8) return true;
    }
    return false;
}

// ── Building Walls (precomputed AABBs for collision) ─────────
// Each building gets 5 wall AABBs: top, left, right, bottom-left-of-door,
// bottom-right-of-door. Door is a 18px gap centered at the building bottom.
const _BUILDING_WALLS = (() => {
    const walls = [];
    const T = 6;       // wall thickness
    const DOOR_W = 36; // door gap width (wide enough for any sprite to walk through)
    for (const town of TOWNS) {
        for (const b of town.buildings) {
            const x = (town.tileX + b.tx) * TILE_SIZE;
            const y = (town.tileY + b.ty) * TILE_SIZE;
            const w = b.tw * TILE_SIZE;
            const h = b.th * TILE_SIZE;
            const doorX = x + w/2 - DOOR_W/2;
            // Top, left, right walls (placed just outside the building footprint)
            walls.push({ x: x-T, y: y-T,  w: w+2*T, h: T });
            walls.push({ x: x-T, y: y,    w: T,    h: h });
            walls.push({ x: x+w, y: y,    w: T,    h: h });
            // Bottom wall split into two segments around the door
            walls.push({ x: x-T,         y: y+h, w: doorX-(x-T),           h: T });
            walls.push({ x: doorX+DOOR_W,y: y+h, w: (x+w+T)-(doorX+DOOR_W),h: T });
        }
    }
    return walls;
})();
export function getBuildingWalls() { return _BUILDING_WALLS; }

// Check whether a (worldX, worldY) point lies inside any town's safe radius.
export function isInsideAnyTown(wx, wy, extraMargin = 0) {
    for (const t of TOWNS) {
        const tx = t.tileX * TILE_SIZE, ty = t.tileY * TILE_SIZE;
        // Use a rectangular "village area" that covers all buildings of the town.
        if (Math.abs(wx - tx) < 22*TILE_SIZE + extraMargin &&
            Math.abs(wy - ty) < 16*TILE_SIZE + extraMargin) return true;
    }
    return false;
}

// ── Monsters ─────────────────────────────────────────────────
export const MonsterTypes = [
    { id:'rat',       name:'Giant Rat',         biomes:['plains','forest'],          minLevel:1,  hp:28,  dmg:5,  speed:115, xp:10,  color:'#795548', size:13, behavior:'chase',   desc:'Fast but weak. Travels in packs. Loves Bert\'s cabbages.' },
    { id:'wisp',      name:"Will-o'-Wisp",      biomes:['plains','bog'],             minLevel:4,  hp:18,  dmg:7,  speed:170, xp:13,  color:'#80DEEA', size:9,  behavior:'erratic', desc:'Ghostly light. Confuses travellers into the bog.' },
    { id:'bat',       name:'Vampire Bat',        biomes:['forest','bog','tundra'],    minLevel:3,  hp:22,  dmg:9,  speed:160, xp:18,  color:'#607D8B', size:11, behavior:'erratic', desc:'Swoops unpredictably. Carries minor diseases.' },
    { id:'mushroom',  name:'Fungal Creeper',     biomes:['forest','bog'],             minLevel:3,  hp:55,  dmg:10, speed:55,  xp:20,  color:'#AED581', size:22, behavior:'chase',   desc:'Slow tank. Spawns from damp soil.' },
    { id:'slime',     name:'Toxic Slime',        biomes:['bog','plains'],             minLevel:5,  hp:65,  dmg:12, speed:60,  xp:25,  color:'#8BC34A', size:24, behavior:'chase',   desc:'Slow, high HP. Dissolves boots on contact.' },
    { id:'wolfkin',   name:'Forest Wolfkin',     biomes:['forest'],                  minLevel:5,  hp:50,  dmg:14, speed:145, xp:28,  color:'#8D6E63', size:17, behavior:'flank',   desc:'Pack hunter. Circles prey with unsettling confidence.' },
    { id:'scorpion',  name:'Sand Scorpion',      biomes:['desert'],                  minLevel:5,  hp:45,  dmg:16, speed:90,  xp:30,  color:'#d4a54a', size:20, behavior:'burrow',  desc:'Burrows and strikes from below. Very rude.' },
    { id:'goblin',    name:'Goblin Rogue',       biomes:['ruins','forest'],           minLevel:7,  hp:50,  dmg:16, speed:130, xp:32,  color:'#4CAF50', size:18, behavior:'flank',   desc:'Cunning flanker. Member of the Goblin Freelancers Guild.' },
    { id:'wraith',    name:'Shadow Wraith',      biomes:['bog','ruins'],              minLevel:7,  hp:38,  dmg:20, speed:140, xp:38,  color:'#7E57C2', size:16, behavior:'erratic', desc:'Ethereal. Passes through walls. Very unpleasant company.' },
    { id:'skeleton',  name:'Skeleton Archer',    biomes:['desert','ruins'],           minLevel:9,  hp:45,  dmg:12, speed:80,  xp:35,  color:'#E0E0E0', size:18, behavior:'ranged',  range:270, desc:'Member of Archers Union Local #47. Currently on strike.' },
    { id:'troll',     name:'Cave Troll',         biomes:['tundra','ruins'],           minLevel:9,  hp:140, dmg:22, speed:70,  xp:50,  color:'#78909C', size:30, behavior:'chase',   desc:'Massive brute. Guards ruins. Not a union member.' },
    { id:'icegolem',  name:'Ice Golem',          biomes:['tundra'],                  minLevel:10, hp:160, dmg:18, speed:50,  xp:55,  color:'#7eb8e8', size:32, behavior:'chase',   desc:'Slow. Freezing aura. Extremely bad vibes.' },
    { id:'harpy',     name:'Harpy',              biomes:['volcanic','desert'],        minLevel:12, hp:60,  dmg:18, speed:180, xp:55,  color:'#F48FB1', size:17, behavior:'erratic', desc:'Swooping predator. Very dramatic.' },
    { id:'golem',     name:'Stone Golem',        biomes:['ruins'],                   minLevel:12, hp:200, dmg:28, speed:50,  xp:70,  color:'#90A4AE', size:36, behavior:'chase',   desc:'Near-invincible guardian of ancient things.' },
    { id:'minotaur',  name:'Minotaur',           biomes:['tundra','ruins','volcanic'],minLevel:15, hp:160, dmg:32, speed:95,  xp:85,  color:'#BF360C', size:32, behavior:'charge',  desc:'Charges with devastating power. Does not accept apologies.' },
    { id:'medusa',    name:'Medusa',             biomes:['desert','ruins'],           minLevel:15, hp:80,  dmg:25, speed:85,  xp:90,  color:'#26C6DA', size:20, behavior:'ranged',  range:300, desc:'Petrifying gaze. Do NOT look at her. She knows.' },
    { id:'hydra',     name:'Hydra',              biomes:['bog'],                     minLevel:18, hp:260, dmg:35, speed:65,  xp:120, color:'#2E7D32', size:38, behavior:'chase',   desc:'Multi-headed terror. Each head has a different complaint.' },
    { id:'elemental', name:'Fire Elemental',     biomes:['volcanic'],                minLevel:18, hp:120, dmg:30, speed:110, xp:100, color:'#ff4400', size:24, behavior:'erratic', desc:'Living fire. Leaves burns. Very enthusiastic about burning.' },
    { id:'dragon',    name:'Lesser Dragon',      biomes:['volcanic','void'],         minLevel:1,  hp:400, dmg:35, speed:95,  xp:200, color:'#F44336', size:44, behavior:'flank',   isBoss:true, desc:'Ancient terror. Circles prey. Does not appreciate being called \'lesser\'.' },
    { id:'lich',      name:'The Lich',           biomes:['ruins','void'],            minLevel:1,  hp:320, dmg:28, speed:75,  xp:250, color:'#B39DDB', size:38, behavior:'ranged',  range:290, isBoss:true, desc:'Undead sorcerer. Personally offended by heroes.' },
    { id:'snorflaxia',name:'Grand Witch Snorflaxia',biomes:['void'],                 minLevel:1,  hp:2000,dmg:55, speed:80,  xp:5000,color:'#9c00ff', size:54, behavior:'ranged',  range:350, isBoss:true, desc:'The Chronically Disappointed. Final Boss. 200 years of waiting. Her patience: expired.' },
];

export const BIOME_SPAWN_TABLES = {
    plains:   ['rat','bat','wisp'],
    forest:   ['wolfkin','mushroom','bat','rat'],
    desert:   ['scorpion','skeleton','medusa'],
    bog:      ['slime','wraith','hydra','mushroom','bat'],
    tundra:   ['icegolem','troll','minotaur','bat'],
    ruins:    ['goblin','skeleton','golem','wraith','troll'],
    volcanic: ['elemental','minotaur','harpy','dragon'],
    void:     ['lich','dragon','golem','elemental','snorflaxia'],
};

// ── Equipment ────────────────────────────────────────────────
export const ARMOR_ITEMS  = [
    { name:'Leather Armor', rarity:'common',   color:'#9e9e9e', damageReduction:0.10, slot:'armor' },
    { name:'Chain Mail',    rarity:'uncommon', color:'#4caf50', damageReduction:0.22, slot:'armor' },
    { name:'Plate Armor',   rarity:'rare',     color:'#5c9be8', damageReduction:0.38, slot:'armor' },
];
export const RING_ITEMS   = [
    { name:'Iron Ring',     rarity:'common',   color:'#9e9e9e', damageMult:1.12, slot:'ring' },
    { name:'Silver Ring',   rarity:'uncommon', color:'#4caf50', damageMult:1.25, slot:'ring' },
    { name:'Gemstone Ring', rarity:'rare',     color:'#5c9be8', damageMult:1.40, slot:'ring' },
];
export const SHIELD_ITEMS = [
    { name:'Wooden Shield', rarity:'common',   color:'#9e9e9e', blockDuration:1.0, cooldown:14, reflects:false, slot:'shield' },
    { name:'Iron Shield',   rarity:'uncommon', color:'#4caf50', blockDuration:1.2, cooldown:10, reflects:false, slot:'shield' },
    { name:'Runic Shield',  rarity:'rare',     color:'#5c9be8', blockDuration:1.5, cooldown:7,  reflects:true,  slot:'shield' },
];

export const CHEST_SPAWN_DATA = [
    { x: 550, y:   0, loot:ARMOR_ITEMS[0]  }, { x:   0, y:-550, loot:RING_ITEMS[0]   },
    { x:1000, y: 900, loot:ARMOR_ITEMS[1]  }, { x:-900, y:1000, loot:RING_ITEMS[1]   },
    { x:1600, y:   0, loot:ARMOR_ITEMS[2]  }, { x:   0, y:1600, loot:RING_ITEMS[2]   },
    { x:-350, y: 350, loot:SHIELD_ITEMS[0] }, { x:-950, y:-500, loot:SHIELD_ITEMS[1] },
    { x: 700, y:-1400,loot:SHIELD_ITEMS[2] },
    { x:(TOWNS[0].tileX-12)*TILE_SIZE, y:(TOWNS[0].tileY-3)*TILE_SIZE, loot:ARMOR_ITEMS[0]  },
    { x:(TOWNS[1].tileX+8)*TILE_SIZE,  y:(TOWNS[1].tileY-3)*TILE_SIZE, loot:ARMOR_ITEMS[1]  },
    { x:(TOWNS[2].tileX+7)*TILE_SIZE,  y:(TOWNS[2].tileY-2)*TILE_SIZE, loot:RING_ITEMS[1]   },
    { x:(TOWNS[3].tileX+8)*TILE_SIZE,  y:(TOWNS[3].tileY-6)*TILE_SIZE, loot:SHIELD_ITEMS[1] },
    { x:(TOWNS[4].tileX-14)*TILE_SIZE, y:(TOWNS[4].tileY-3)*TILE_SIZE, loot:ARMOR_ITEMS[2]  },
    { x:(TOWNS[4].tileX+8)*TILE_SIZE,  y:(TOWNS[4].tileY-7)*TILE_SIZE, loot:RING_ITEMS[2]   },
];

export const DEATH_QUOTES = [
    '"Perhaps next time wear better boots."',
    '"The Seer predicted this. Gerald the Frog also predicted this."',
    '"A bold strategy. It did not work."',
    '"Snorflaxia sends her regards. Well, not really. She has no idea who you are."',
    '"Seven out of ten. We\'ll say seven out of ten effort."',
    '"The cabbages remain unguarded."',
];
