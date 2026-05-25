# Endless Chronicles: Realm of Grumbleshire — PRD

## Original Problem Statement
Upgrade an existing 2D rogue-like web game ("Endless Chronicles") to be more
professional and ready for real players. Evolve the vanilla HTML/CSS/JS
prototype into a polished pixel-art roguelike with seeded open-world
exploration, biomes, towns, NPCs, completely silly lore, balanced progression,
better combat feel, quests, achievements, on-demand chunk loading capable of
supporting millions of blocks, and an ultra-difficult endgame.

## User Preferences
- Incremental approach (phase-by-phase delivery)
- Polished pixel-art tile look
- "Completely silly" lore voice throughout
- OK to break old save compatibility
- Response language: English

## Tech Stack
- Vanilla HTML5 + CSS3 + JavaScript (ES6 modules)
- HTML5 Canvas rendering loop (`requestAnimationFrame`)
- TailwindCSS via CDN for UI overlays
- LocalStorage for save game + persistent achievements
- No backend / database — fully client-side

## Architecture
```
/app/
├── endlessChronicles.html        Entry, UI overlays (menu / hud / dialogs / screens)
├── endlessChronicles.css         Styling
├── js/                           ES6 source (11 modules, ~2700 lines total)
│   ├── state.js          Constants, shared `S` state, canvas/camera init
│   ├── biomes.js         Seeded noise + 8 biomes + LRU biome cache
│   ├── world.js          Towns, road graph, MonsterTypes, items, chest data
│   ├── chunks.js         On-demand chunk gen + LRU cache + spatial pruning
│   ├── entities.js       Player, NPC, Enemy, Projectile, ArcherTower, particles
│   ├── systems.js        Quest system + Spawn manager + save/load
│   ├── achievements.js   Persistent stats + 15 achievement defs + toast callback
│   ├── ui.js             Minimap, HUD, dialogs, bestiary, achievements screen
│   ├── game.js           Main loop + start/pause/resume/gameOver/victory
│   ├── input.js          Keyboard, mouse, mobile, UI button handlers
│   └── main.js           Bootstrap entry point
└── memory/PRD.md
```

Cross-module mutable state lives in a single `S` object exported from
`state.js`. Persistent stats live in localStorage under `endlessChronicles_achievements`.

Sacred seed: `69420`.

## Implemented Features

### Phase 1 — Open World + Silly Lore + AI (Verified)
- Seeded open world (deterministic noise → biomes/towns/paths)
- 8 biomes: Ticklegrass Plains, Murmuring Murk, The Sandy Bits,
  Soggy Bog of Despair, Frostbitten Tundra, Ruins of Wobblethwaite,
  Doom Fields of Questionable Lava, Void of Questionable Decisions
- 5 procedural towns w/ silly names (Flumpton, Bumblesnatch, Sandpocket,
  Grimwhistle, Frostholm) + NPCs with multi-line dialogue
- Roads connecting points of interest
- 3 player classes: Human Knight, Arcane Wizard, Feral Beast
- 21 monster types incl. 3 bosses (Lesser Dragon, The Lich, Grand Witch Snorflaxia)
- Behaviors: chase / flank / erratic / ranged / burrow / charge
- Improved mob AI: aggro radius scales with player level, group-aggro for rats,
  charge windups (minotaur), burrow attacks (scorpion)
- Difficulty selector (Easy/Normal/Hard) — scales mob HP/dmg/speed/spawn rate
- Polished pixel art tiles + sprites + atmospheric biome overlays
- Mobile touch controls (d-pad + ATK + E buttons)
- Save/load, bestiary, lore screen, level-up screen, game-over screen, HUD,
  pause menu, minimap

### Phase 2 — Refactor + "Millions of Blocks" (Verified)
- **Modular ES6 architecture** (10 modules, ~209-line avg) replacing 1936-line monolith
- **LRU chunk cache** with insertion-order touch on hit (Map preserves order)
- **Spatial chunk pruning** every 2s evicts chunks > 8 chunks from camera
- **LRU biome cache** with batch eviction at 80K entries
- Verified: 9s continuous travel → cache held 77 chunks of 256 cap

### Phase 3 — Achievements + Quest Turn-In + Snorflaxia Endgame (Verified Feb 2026)
- **15-achievement system** with persistent cross-run stats
  (First Blood, Centurion, Legion Slayer, Rat King, Tourist, Cartographer,
   Collector, Leveled Up, High-Tier Hero, Master of Grumbleshire,
   Dragon Slayer, Lich Killer, Void Walker, The Chronically Pleased (Snorflaxia),
   Quest Master)
- **Achievement toast notifications** — animated slide-in, queued, gold-bordered
- **Achievements screen** with locked/unlocked rows + lifetime stats line
  (Total Kills, Chests, Quests, Highest Lvl, Runs)
- **NPC quest turn-in flow**: each of 5 quests now has a designated quest-giver NPC
  - When conditions met: quest goes `ready: true` (gold "TURN IN" + giver line in tracker)
  - Pulsing gold `!` mark over the right NPC; `[F] Turn in!` prompt when adjacent
  - Press F → dialog with reward acknowledgement, quest marked complete
- **Endless progression scaling**: spawn interval & enemy cap curves added for
  lv 30+ and lv 50+ levels
- **Snorflaxia endgame**: when player enters Void biome at level 20+,
  Grand Witch Snorflaxia auto-spawns with level-scaled HP (~16.5k @ lv25),
  unleashes 5-fireball spreads, summons void minions every 4.5s, and at
  50% HP enters Phase 2 (7-fireball wider spread + 1.5× speed)
- **Victory screen** triggered on Snorflaxia kill — silly quotes,
  level/score/kills, "RETURN TO TITLE" button
- **Phase 2 dialogue moment**: *"Now I am SLIGHTLY MORE disappointed."*

### Phase 4 — World Feel & Fairness Patches (Verified Feb 2026)
Addressed playtest feedback that the world felt empty and unfair:
- **Towers moved to wild hostile biomes** (ruins/volcanic/void) — deterministic
  seeded positions (`hasTowerAtTile`). No towers in or near friendly towns.
- **No arrow drops or spawns for Wizard class** — they're a useless inventory
  taking up screen space. Knight gets arrows, Beast gets rocks, Wizard gets neither.
- **Town building walls are solid** — both player and enemies are pushed out of
  building AABBs. Each building has a 36px door gap at center-bottom that
  remains the only passable entry.
- **Enemies never spawn inside town areas** — spawn manager rejects any spawn
  point within 22×16 tiles of a town center; up to 6 retries before skipping.
- **Town slow-spawn**: while player is inside any town the spawn timer extends
  to 6s, so towns feel like safe havens.
- **Announcement cooldown (90s)** for both town flash banners and biome name
  float-text. No more banner spam when wandering in/out.
- **Manual fix**: "Shield: SHIFT (Knight only)" corrected to "any class —
  requires equipped shield".
- **Engagement boost**: enemies now aggro by default (no more passive wander),
  spawn interval lowered at level 1 (`0.85s` baseline → `~0.6s` after diff modifier),
  and procedural **wild chests** (`hasWildChestAtTile`) are scattered across
  non-plains biomes with biome-difficulty-tiered loot.

## Verification Status
- Smoke-tested via Playwright: menu, all 3 classes, gameplay, pause/resume,
  achievement unlock chain, quest ready → turn-in → completion, Snorflaxia
  victory screen + Void Walker achievement. Zero JS console errors.
- Programmatic verification of every integration point:
  `first_blood` unlocks on first kill, `witch_hunter` on Snorflaxia death,
  Void Walker on biome entry; quest progress + ready flag propagate to UI;
  toast queue processes correctly.

## Roadmap

### P1 — Next
- Async/throttled chunk generation (yield between chunks for ultra-smooth sprints)
- More boss attack patterns (true 3-phase Snorflaxia with arena teleports)
- More quest types from various NPCs (delivery, fetch, escort)

### P2 — Future
- Sound effects & music
- Shareable seeds — URL/code so friends drop into same realm
- Mobile UI polish (responsive layout for portrait/landscape)
- Cloud save (would require backend)
- More biome-specific assets (volcanic creatures, ice-only spells, etc.)

## Test Credentials
N/A (client-side only, no auth)

## Known Limitations
- TailwindCSS CDN warning (acceptable for dev/preview)
- Game state lives in localStorage; no cloud save
- Persistent achievements file can be reset by user via DevTools
