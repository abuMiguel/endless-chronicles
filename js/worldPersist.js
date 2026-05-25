// ============================================================
// WORLD PERSISTENCE
// Tracks one-shot world events that should survive across runs:
//   - Opened wild chest keys (don't re-appear full)
//   - Activated wilderness shrines (one-time buff per shrine)
// Stored in localStorage as a single JSON blob.
// ============================================================
'use strict';

const STORAGE_KEY = 'endlessChronicles_world';

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { openedChests: [], usedShrines: [] };
        const parsed = JSON.parse(raw);
        return {
            openedChests: parsed.openedChests || [],
            usedShrines: parsed.usedShrines || [],
        };
    } catch (_) {
        return { openedChests: [], usedShrines: [] };
    }
}

const _data = load();
const openedChestSet = new Set(_data.openedChests);
const usedShrineSet  = new Set(_data.usedShrines);

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            openedChests: Array.from(openedChestSet),
            usedShrines: Array.from(usedShrineSet),
        }));
    } catch (_) {}
}

export const worldPersist = {
    isChestOpened(key)    { return openedChestSet.has(key); },
    markChestOpened(key)  { openedChestSet.add(key); save(); },

    isShrineUsed(key)     { return usedShrineSet.has(key); },
    markShrineUsed(key)   { usedShrineSet.add(key); save(); },

    reset() {
        openedChestSet.clear();
        usedShrineSet.clear();
        save();
    },
};
