# Endless Chronicles: Realm of Grumbleshire — PRD

## Original Problem Statement
Upgrade an existing 2D rogue-like web game ("Endless Chronicles") to be more
professional and ready for real players. The vanilla HTML/CSS/JS prototype
must evolve into a polished pixel-art roguelike with seeded open-world
exploration, biomes, towns, NPCs, completely silly lore, balanced progression,
better combat feel, quests, achievements, on-demand chunk loading capable of
supporting millions of blocks, and an ultra-difficult endgame.

## User Preferences (from session ask_human)
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

## Architecture
```
/app/
├── endlessChronicles.html   Entry point, all UI overlays (HUD, menus, dialogs)
├── endlessChronicles.css    Styling (panels, controls, pixel art rendering)
├── endlessChronicles.js     Game engine (1936 lines, ES6 module)
│   ├── Seeded noise + biome generation
│   ├── Chunk-aware tile cache
│   ├── Player / Enemy / Projectile / Item state
│   ├── Combat & mob AI
│   ├── Quest tracker
│   ├── NPC dialogue + town spawning
│   └── Canvas render loop
└── memory/PRD.md, CHANGELOG.md, ROADMAP.md
```

Sacred seed: `69420` (set in `WORLD_SEED`).

## Implemented (Phase 1 — verified Feb 2026)
- Seeded open world (deterministic noise → biomes/towns/paths)
- 8 biomes: Ticklegrass Plains, Murmuring Murk (forest), The Sandy Bits
  (desert), Soggy Bog of Despair, Frostbitten Tundra, Ruins of Wobblethwaite,
  Doom Fields of Questionable Lava, Void of Questionable Decisions
- Procedural towns w/ silly names (Flumpton, Bumblesnatch, Sandpocket,
  Grimwhistle, Frostholm)
- Roads/paths connecting points of interest
- 3 player classes: Human Knight, Arcane Wizard, Feral Beast
  (each with unique stats, abilities, pixel-art sprite)
- 5-quest tracker: Pest Control, Explorer, Treasure Hunter, Monster Slayer,
  Biome Walker
- Pause menu, save/load, bestiary, lore screen, level-up screen,
  game-over screen
- HUD: HP/Mana/XP bars, stats (VIT/STR/AGI/PWR), equipment slots,
  ammo counter, biome name + coords
- Minimap with town markers
- Improved mob AI (biome-based spawning, difficulty scaling)
- Completely silly lore: Bram the Adequate, Snorflax the Mildly Inconvenient,
  Grand Witch Snorflaxia the Chronically Disappointed, Gerald the Oracle Frog
- Mobile touch controls (d-pad + ATK + E buttons)
- Polished pixel art (image-rendering: pixelated, custom tile colors per biome)

## Verification Status
- Loaded via static server, full smoke test passed: start screen renders,
  class selection works, all 3 classes load, gameplay starts cleanly,
  movement/pause/quests all functional, zero JS console errors.

## Roadmap

### P1 — Next
- On-demand chunk loading optimization for "millions of blocks" target
- Achievements system (persistent across runs)
- Quest dialog flow improvements (NPC turn-in, rewards)

### P2 — Future
- Endless progression scaling (post-endgame difficulty curves)
- Deeper NPC dialogue trees + branching silly lore
- Ultra-difficult endgame configuration in The Void
- Boss encounter: Grand Witch Snorflaxia
- Sound effects & music
- Refactor `endlessChronicles.js` into ES6 modules
  (`world.js`, `combat.js`, `player.js`, `quests.js`)

## Test Credentials
N/A (client-side only, no auth)

## Known Limitations
- TailwindCSS CDN warning (acceptable for dev/preview)
- All game state lives in localStorage; no cloud save
