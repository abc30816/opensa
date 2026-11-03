# OpenSA component assessment for the full San Andreas browser port

## Decision

OpenSA is a useful source of reusable, licensed engine components. It is **not** the completed GTA San Andreas game and must not be treated as the final deliverable.

The work should reuse or adapt components only where they genuinely help, preserve their license and notices, and then implement the missing gameplay systems. The target remains the full original single-player San Andreas experience in a browser, using the player's own local game installation.

## Useful existing components

The current OpenSA architecture documents these useful pieces:

- `@opensa/renderware`: DFF/TXD/COL/IMG readers, IDE/IPL/DAT/GXT parsers, archive interfaces and Three.js builders.
- `@opensa/loaders` and `@opensa/vfs`: local/fetch asset loading and a virtual file-system boundary.
- `@opensa/game`: ECS, game loop, streaming, physics, character, vehicle, time, weather, zones and rendering plugins.
- World pipeline: GTA.DAT/IDE/IPL resolution, world grid, HD/LOD streaming and collision cells.
- Visual systems: SA prelit world materials, timecyc-driven sky/weather/fog/water, night lighting and corona effects.
- Some player and vehicle foundations: skinned DFF models, IFP locomotion, camera, Rapier character controller, vehicle models, handling, suspension and enter/exit phases.

Sources: `docs/architecture.md`, `docs/features/README.md`, and the linked per-feature documents on the current main branch.

## Why it is not the full game

OpenSA's own feature documents list significant gaps:

- Character document: one selected character model, no populated pedestrian/NPC simulation; animation is currently locomotion plus vehicle entry/exit rather than the complete original animation/state set.
- Vehicle document: no NPC traffic and no vehicle audio.
- Map pipeline: interiors are filtered out, and IPL sections including `enex`, `occlu`, `grge`, `pick`, `jump`, `tcyc`, `auzo` and `mult` are not implemented.
- Weather document: precipitation effects and underwater state are missing; water is visual-only.
- Night/time document: traffic-light phases, projected road headlight beams and corona occlusion are incomplete.
- The feature catalog does not provide a complete original SCM mission interpreter, cutscene system, full police/wanted/combat behaviours, radio/music implementation or original save compatibility.

Those missing systems are required by the full-game goal. They must be added and tested rather than hidden behind a claim that the map is already the game.

## Reuse and licensing

OpenSA's root README declares its original code AGPL-3.0-only. Any code copied or modified from it must retain required notices and comply with the license, including corresponding-source obligations where applicable. This assessment does not copy proprietary Rockstar assets.

## Acceptance target

Do not call the port complete until it can:
1. Boot and start a new game from the original opening.
2. Stream the full exterior world and enter/exit all required interiors.
3. Support the original CJ/player animation, controls, camera, weapons and combat.
4. Run pedestrians, gangs, traffic, police, wanted levels and vehicle AI.
5. Support vehicles, handling, damage, emergency systems, garages and other original vehicle interactions.
6. Execute the original mission/story scripts and required cutscenes in sequence.
7. Reproduce HUD, pause/options, map/radar, shops, side activities and audio/radio.
8. Save and reload progress and complete the full story without mission blockers.

A subsystem is accepted only after behaviour tests, not merely because its file parser exists.
