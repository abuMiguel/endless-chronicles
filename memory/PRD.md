# Endless Chronicles: Realm of Grumbleshire — PRD

## Original Problem Statement
Upgrade an existing 2D rogue-like web game ("Endless Chronicles") to be more
professional and ready for real players. The vanilla HTML/CSS/JS prototype
must evolve into a polished pixel-art roguelike with seeded open-world
exploration, biomes, towns, NPCs, completely silly lore, balanced progression,
better combat feel, quests, achievements, on-demand chunk loading capable of
supporting millions of blocks, and an ultra-difficult endgame.

## User Preferences
- Incremental approach (Phase 1 first, then Phase 2, etc.)
- Phase 1 priority: fixed seeded world map with biomes, towns, paths,
  non-hostile NPCs, and improved mob AI
- Polished pixel-art tile look
- "Completely silly" lore voice
- OK to break old save compatibility
- Response language: English

## Tech Stack
- Vanilla HTML5 + CSS3 + JavaScript (ES6 modules)
- HTML5 Canvas rendering loop (`requestAnimationFrame`)
- TailwindCSS via CDN for UI overlays
- No backend / database — fully client-side
- LocalStorage for save game

## Architecture (post-refactor, Feb 2026)
```
/app/
├── endlessChronicles.html     Entry point, UI overlays
├── endlessChronicles.css      Styling
├── js/                        ES6 module source (2090 lines total)
│   ├── state.js     (66)     Constants, GameState, shared `S` state object,
│   │                         canvas/camera init, cache-size knobs
│   ├── biomes.js    (84)     Seeded noise + biome map + LRU biome cache
│   ├── world.js    (244)     TOWNS, road graph, MonsterTypes, items, chests
│   ├── chunks.js   (264)     On-demand chunk gen + LRU cache + distance prune
│   ├── entities.js (644)     Player, NPC, Enemy, Projectile, ArcherTower
│   ├── systems.js  (147)     Quest system + Spawn manager + save/load
│   ├── ui.js       (208)     Minimap, HUD, dialogs, bestiary, class previews
│   ├── game.js     (297)     Main loop + start/pause/resume/gameOver
│   ├── input.js    (115)     Keyboard, mouse, mobile, UI button handlers
│   └── main.js      (21)     Bootstrap entry point
└── memory/PRD.md
```

Cross-module mutable state lives in a single shared `S` object exported from
`state.js`. All other modules read/write via `S.player`, `S.enemies`, etc. —
keeping module boundaries clean while supporting the inherent coupling of a
game loop.

Sacred seed: `69420` (set in `WORLD_SEED`).

## Implemented Features (Verified Feb 2026)

### Phase 1 — Open World + Silly Lore + AI
- Seeded open world (deterministic noise → biomes/towns/paths)
- 8 biomes: Ticklegrass Plains, Murmuring Murk (forest), The Sandy Bits
  (desert), Soggy Bog of Despair, Frostbitten Tundra, Ruins of Wobblethwaite,
  Doom Fields of Questionable Lava, Void of Questionable Decisions
- 5 procedural towns with silly names (Flumpton, Bumblesnatch, Sandpocket,
  Grimwhistle, Frostholm) + NPCs with multi-line silly dialogue
- Roads connecting points of interest
- 3 player classes: Human Knight, Arcane Wizard, Feral Beast
- 5-quest tracker: Pest Control, Explorer, Treasure Hunter, Monster Slayer,
  Biome Walker
- 21 monster types across 8 tiers + 3 boss types (Lesser Dragon, The Lich,
  Grand Witch Snorflaxia)
- Behaviors: chase / flank / erratic / ranged / burrow / charge
- Improved mob AI: aggro radius scales with player level, group-aggro for rats,
  charge windups, scorpion burrow attacks, minotaur charge
- Difficulty selector (Easy/Normal/Hard) scales mob HP/dmg/speed/spawn rate
- Pause menu, save/load, bestiary, lore screen, level-up screen, game-over
- HUD: HP/Mana/XP bars, stats, equipment slots, ammo, biome name + coords
- Minimap with town markers
- Polished pixel art tiles + sprites (`image-rendering: pixelated`)
- Mobile touch controls (d-pad + ATK + E buttons)
- Atmospheric biome overlays (volcanic glow, void darkness, tundra haze)

### Phase 2 — Refactor + "Millions of Blocks" (Feb 2026)
- **Modular ES6 architecture** (10 modules, ~209-line average) replacing the
  1936-line monolith
- **LRU chunk cache** with insertion-order touch on hit (Map preserves order)
- **Spatial chunk pruning** every 2s: evict chunks farther than 8 chunks
  (~4096px) from camera. Bounds memory at ~256 chunks regardless of distance
- **LRU biome cache** with batch eviction at 80K entries (replaces brittle
  `clear-when-full` strategy)
- Verified: after 9s of continuous travel (Tile 0 → Tile 63), chunk cache
  held only 77 entries — world supports arbitrary exploration without leaking

## Verification Status
- Loaded via static server, full smoke test passed: start screen renders,
  all 3 classes load, gameplay starts cleanly, movement/pause/quests all
  functional, zero JS console errors after refactor.

## Roadmap

### P1 — Next
- NPC quest turn-in flow (talk to NPC to claim rewards instead of auto)
- Persistent achievements system (cross-run progression)
- Async chunk generation (yield between chunks to prevent frame spikes when
  exploring fast)

### P2 — Future
- Endless progression scaling (post-endgame difficulty curves)
- Deeper NPC dialogue trees + branching silly lore
- Ultra-difficult endgame configuration in The Void
- Boss encounter: Grand Witch Snorflaxia at world center
- Sound effects & music
- Shareable seeds feature (let players post their realm seed)

## Test Credentials
N/A (client-side only, no auth)

## Known Limitations
- TailwindCSS CDN warning (acceptable for dev/preview)
- All game state lives in localStorage; no cloud save
