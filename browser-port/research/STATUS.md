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

- entrypoint-call-trace.md: startup path and a candidate top-level application/message-loop routine.
- application-state-dispatch.md: ten application-state handlers, not yet semantically named.
- asset-path-crossrefs.md: paths and candidate parsers for GTA3.IMG, GTA_INT.IMG, PLAYER.IMG, GTA.DAT, TIMECYC.DAT and HANDLING.CFG.
- main-scm-loader-and-opcode-dispatch.md: the program opens data/script/main.scm, reads a 200,000-byte region, and contains an opcode/operand dispatcher for 0x00D6–0x0129. The thread's bytecode cursor is observed at object offset +0x14. Only one opcode range is mapped; the full script VM and command semantics are not yet reconstructed.
- SCM_VM_STATIC_MAP.md and SCM_DISPATCH_MAP.json: mapped all 27 top-level opcode groups, the direct opcode tables for groups 0 and 1, the group-2 second-level route table, and typed input/output operand and variable-destination readers.
- SCM_THREAD_PROCESSING.md: mapped the global script update pass at 0x0046A080 and per-thread runner at 0x00469F80, including linked-record traversal, command-loop yield/budget behavior and observed thread fields. This is a static map, not an implemented browser scheduler.

All analysis is static. The original executable has not been run, emulated, injected into, unpacked or modified. SecuROM has not been bypassed.

## Reusable engine groundwork

OpenSA contains parsers/builders and engine subsystems that can reduce duplicated work: RenderWare DFF/TXD/COL/IMG handling, IDE/IPL/DAT readers, world grid/LOD streaming, some collision and vehicle/player systems, and timecyc/prelit lighting. OpenSA's own feature references still list major gaps in NPCs, interiors, vehicle audio, full animation, mission/cutscene handling, combat/police, radio and save compatibility.

## Current code/artifact state

- This branch contains a separate static executable/folder inspection workbench and research notes.
- The workbench has not yet been validated in the user's Codespace/browser. Do not ask the user to grant GTA-folder permission until that source and runtime origin have been audited.
- No full renderer/game loop, gameplay simulation, script VM, mission system or playable build exists yet.
- The user's complete GTA folder has not been selected or read in this branch. The uploaded executable alone cannot validate asset compatibility.
- A separate local research scaffold has passed its test suite (34 Node tests, one native CTest target; one AddressSanitizer/UndefinedBehaviorSanitizer CTest target). Those are parser/safety-fixture tests, not full-game tests and not evidence this branch's workbench compiles.

## Next implementation/research gates

1. Map the remaining SCM opcode ranges and running-script scheduler; validate definitions against the user's actual MAIN.SCM and SCRIPT.IMG when safely available.
2. Map renderer/world/streaming entry points and distinguish them from protected .dev1 redirection points; do not follow or bypass protected regions.
3. Reuse/adapt OpenSA's licensed format readers and world/render pipeline where they match the target, while tracking each missing full-game system as a separate tested feature.
4. Extend format support to the actual user's game files without uploading copyrighted assets.
5. Implement the browser renderer and game runtime, then gameplay systems in dependency order.
6. Test story completion and feature parity; do not label partial milestones as the full game.

## Completion rule

The project is not complete until the original story can be played from a fresh start through the ending, with the required world, gameplay, audio, cutscenes and saves. Any missing feature must remain visible in the status list.
