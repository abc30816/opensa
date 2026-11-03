# Development status — full GTA San Andreas browser port

Updated: 2026-11-03

## Target

A local browser game using the user's own GTA San Andreas PC installation, with the original single-player experience from new game to story completion. A map viewer or free-roam-only demo does not meet the target.

Required systems include the complete streamed world/interiors, CJ and animation states, vehicles and handling, peds/gangs/traffic/police, wanted/combat/weapons, original mission scripts and cutscenes, shops/side activities, HUD/map/radar, audio/radio/dialogue, saves and game menus.

## Repository decision

OpenSA is allowed as a source of useful components, not as the completed game. Its source declares AGPL-3.0-only; any reuse/adaptation must comply with that license and preserve notices/source obligations. Rockstar game assets remain the user's local files and are not added to this repository.

See open-sa-reuse-assessment.md for the component-by-component gap review.

## Executable research performed

Target binary fingerprint is recorded in pc-exe-entrypoint-and-imports.md.

New function-level findings:

- `entrypoint-call-trace.md`: startup path and a candidate top-level application/message-loop routine.
- `application-state-dispatch.md`: ten application-state handlers, not yet semantically named.
- `asset-path-crossrefs.md`: references for GTA3.IMG, GTA_INT.IMG, PLAYER.IMG, GTA.DAT, TIMECYC.DAT and HANDLING.CFG, including preliminary time-cycle and handling parser candidates.
- `main-scm-loader-and-opcode-dispatch.md`: opens `data/script/main.scm`, reads a 200,000-byte block at the observed initialization site, and records the original script cursor/opcode-fetch logic.
- `SCM_VM_STATIC_MAP.md` and `SCM_DISPATCH_MAP.json`: all 27 top-level opcode groups, group 0/1 direct tables, group 2's 84-entry second-level table, typed input operand readers and typed output destination readers.
- `SCM_GROUP2_COMMAND_CROSSCHECK.md` and `.json`: 26 selected group-2 commands cross-checked against a community SASCM.INI parameter-count reference. This is not a complete command catalogue.
- `SCM_THREAD_PROCESSING.md`: global script update pass at `0x0046A080`, per-thread runner at `0x00469F80`, cursor-yield/budget logic and linked-record traversal.
- `SCM_THREAD_LIFECYCLE.md`: 96 fixed records of `0xE0` bytes, default name `noname`, constructor, active-list insertion and name-based cleanup call sites. Protected list/allocator helpers remain uninspected.

The executable was analysed as data only. Startup/frame-loop and SCM findings are preliminary static reverse-engineering, not a complete engine function map.

All analysis is static. The original executable has not been run, emulated, injected into, unpacked or modified. SecuROM has not been bypassed.

## Reusable engine groundwork

OpenSA contains parsers/builders and engine subsystems that can reduce duplicated work: RenderWare DFF/TXD/COL/IMG handling, IDE/IPL/DAT readers, world grid/LOD streaming, some collision and vehicle/player systems, and timecyc/prelit lighting. OpenSA's own feature references still list major gaps in NPCs, interiors, vehicle audio, full animation, mission/cutscene handling, combat/police, radio and save compatibility.

## Current code/artifact state

- This branch contains a separate static executable/folder inspection workbench and research notes.
- The workbench has not yet been validated in the user's Codespace/browser. Do not ask the user to grant GTA-folder permission until that source and runtime origin have been audited.
- No full renderer/game loop, gameplay simulation, script VM, mission system or playable build exists yet.
- The user's complete GTA folder has not been selected or read in this branch. The uploaded executable alone cannot validate asset compatibility.
- Local validation: 34 browser parser/safety tests passed; 6 static-extractor Python tests passed; native C++ Release CTest passed; native AddressSanitizer + UndefinedBehaviorSanitizer CTest passed; Python syntax checks passed. Most parser fixtures are synthetic. These tests do not establish full-game compatibility or prove this GitHub branch's workbench compiles.

## Next implementation/research gates

1. Map remaining SCM opcode handlers and exact thread-slot allocation/recycling behavior without following protected .dev1 pointers; validate definitions against the user's actual MAIN.SCM and SCRIPT.IMG when safely available.
2. Map renderer/world/streaming entry points and distinguish them from protected .dev1 redirection points; do not follow or bypass protected regions.
3. Reuse/adapt OpenSA's licensed format readers and world/render pipeline where they match the target, while tracking each missing full-game system as a separate tested feature.
4. Extend format support to the actual user's game files without uploading copyrighted assets.
5. Implement the browser renderer and game runtime, then gameplay systems in dependency order.
6. Test story completion and feature parity; do not label partial milestones as the full game.

## Completion rule

The project is not complete until the original story can be played from a fresh start through the ending, with the required world, gameplay, audio, cutscenes and saves. Any missing feature must remain visible in the status list.
