// ============================================================
// ACHIEVEMENTS  ─  persistent cross-run progression stats
// ============================================================
'use strict';

const STORAGE_KEY = 'endlessChronicles_achievements';

// Achievement definitions. `check(stats)` decides unlock.
export const ACHIEVEMENT_DEFS = [
    { id:'first_blood',   icon:'⚔', title:'First Blood',              desc:'Slay your first monster.',           check:s => s.totalKills >= 1 },
    { id:'centurion',     icon:'⚔', title:'Centurion',                desc:'Slay 100 monsters.',                 check:s => s.totalKills >= 100 },
    { id:'legion',        icon:'⚔', title:'Legion Slayer',            desc:'Slay 500 monsters.',                 check:s => s.totalKills >= 500 },
    { id:'rat_king',      icon:'🐀', title:'Rat King',                 desc:'Slay 50 Giant Rats. Bert is impressed (mildly).', check:s => (s.kills?.rat||0) >= 50 },
    { id:'tourist',       icon:'🏠', title:'Tourist',                  desc:'Visit all 5 towns.',                 check:s => (s.townsVisited?.length||0) >= 5 },
    { id:'cartographer',  icon:'🗺', title:'Cartographer',             desc:'Visit all 8 biomes.',                check:s => (s.biomesVisited?.length||0) >= 8 },
    { id:'collector',     icon:'📦', title:'Collector',                desc:'Open 25 chests.',                    check:s => s.chestsOpened >= 25 },
    { id:'leveled_up',    icon:'⭐', title:'Leveled Up',               desc:'Reach level 10.',                    check:s => s.maxLevel >= 10 },
    { id:'high_tier',     icon:'⭐', title:'High-Tier Hero',           desc:'Reach level 25.',                    check:s => s.maxLevel >= 25 },
    { id:'master',        icon:'👑', title:'Master of Grumbleshire',   desc:'Reach level 50.',                    check:s => s.maxLevel >= 50 },
    { id:'dragon_slayer', icon:'🐉', title:'Dragon Slayer',            desc:'Defeat a Lesser Dragon.',            check:s => (s.bossKills?.dragon||0) >= 1 },
    { id:'lich_killer',   icon:'💀', title:'Lich Killer',              desc:'Defeat The Lich.',                   check:s => (s.bossKills?.lich||0) >= 1 },
    { id:'void_walker',   icon:'🌌', title:'Void Walker',              desc:'Enter the Void of Questionable Decisions.', check:s => (s.biomesVisited||[]).includes('void') },
    { id:'witch_hunter',  icon:'✨', title:'The Chronically Pleased',  desc:'Defeat Grand Witch Snorflaxia. Finally.', check:s => (s.bossKills?.snorflaxia||0) >= 1 },
    { id:'questmaster',   icon:'📜', title:'Quest Master',             desc:'Complete 5 quests.',                 check:s => s.questsCompleted >= 5 },
];

// Default stats shape
function freshStats() {
    return {
        totalKills: 0,
        kills: {},
        bossKills: {},
        townsVisited: [],
        biomesVisited: [],
        chestsOpened: 0,
        questsCompleted: 0,
        maxLevel: 1,
        runsStarted: 0,
        runsDied: 0,
        snorflaxiaSlain: false,
    };
}

// ── Persistent state ─────────────────────────────────────────
function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { stats: freshStats(), unlocked: [] };
        const parsed = JSON.parse(raw);
        return {
            stats: { ...freshStats(), ...(parsed.stats||{}) },
            unlocked: parsed.unlocked || [],
        };
    } catch (e) { return { stats: freshStats(), unlocked: [] }; }
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            stats: achievements.stats,
            unlocked: achievements.unlocked,
        }));
    } catch (e) { /* quota or disabled */ }
}

// Callback the UI module sets to receive "newly unlocked" notifications.
let _onUnlock = null;
export function setUnlockCallback(fn) { _onUnlock = fn; }

function checkUnlocks() {
    const newly = [];
    for (const a of ACHIEVEMENT_DEFS) {
        if (achievements.unlocked.includes(a.id)) continue;
        if (a.check(achievements.stats)) {
            achievements.unlocked.push(a.id);
            newly.push(a);
        }
    }
    if (newly.length) {
        save();
        if (_onUnlock) for (const a of newly) _onUnlock(a);
    }
    return newly;
}

const _persisted = load();

export const achievements = {
    stats: _persisted.stats,
    unlocked: _persisted.unlocked,

    recordKill(typeId, isBoss) {
        this.stats.totalKills++;
        this.stats.kills[typeId] = (this.stats.kills[typeId]||0) + 1;
        if (isBoss) this.stats.bossKills[typeId] = (this.stats.bossKills[typeId]||0) + 1;
        if (typeId === 'snorflaxia') this.stats.snorflaxiaSlain = true;
        checkUnlocks();
    },
    recordTownVisit(id) {
        if (!this.stats.townsVisited.includes(id)) {
            this.stats.townsVisited.push(id);
            checkUnlocks();
        }
    },
    recordBiomeVisit(id) {
        if (!this.stats.biomesVisited.includes(id)) {
            this.stats.biomesVisited.push(id);
            checkUnlocks();
        }
    },
    recordChestOpen() {
        this.stats.chestsOpened++;
        checkUnlocks();
    },
    recordLevelUp(level) {
        if (level > this.stats.maxLevel) {
            this.stats.maxLevel = level;
            checkUnlocks();
        }
    },
    recordQuestComplete() {
        this.stats.questsCompleted++;
        checkUnlocks();
    },
    recordRunStart() { this.stats.runsStarted++; save(); },
    recordRunDeath() { this.stats.runsDied++; save(); },
    isUnlocked(id) { return this.unlocked.includes(id); },
    reset() {
        this.stats = freshStats();
        this.unlocked = [];
        save();
    },
};
