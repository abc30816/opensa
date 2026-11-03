# GTA San Andreas browser-port research workbench

This is a separate work area on the `gta-sa-browser-engine` branch. It is **not** the existing OpenSA map demo and it is not a playable GTA game.

## Why reverse engineering comes first

The original PC executable contains engine behaviour that is not available as complete, portable C++ source. A browser port must identify and reimplement that behaviour rather than merely draw RenderWare models. The work is divided into:

1. Static executable analysis: PE layout, imports, entry point, strings, and code regions.
2. Function analysis: identify engine subsystems and map x86 routines to responsibilities without executing the game.
3. Data-format analysis: understand the user's own IMG, DFF, TXD, COL, IPL, IDE, SCM, animation, configuration and audio files.
4. Browser implementation: port systems in dependency order, then compare output and behaviour against references.
5. Regression testing: test world streaming, player, vehicles, AI, missions, interiors, audio, saves and cutscenes.

## First milestone in this folder

The local browser workbench allows the user to choose their own `gta_sa.exe` and/or game folder. It reads the executable bytes in the browser solely for static PE inspection and scans game-folder **names and sizes only**. It does not execute the EXE, modify the game folder, persist folder handles, upload selected files, or call external network services.

The folder picker requests `mode: "read"`. The browser origin still has permission to read the selected files, so review this small workbench's source before granting access. Do not use a folder containing unrelated personal files.

## Run locally

From the repository root, use the existing Vite setup:

```sh
npm install
npm run dev
```

Then open `/browser-port/index.html` on the Vite origin (localhost). The File System Access API requires a secure context such as localhost or HTTPS and a compatible Chromium browser.

## Current limitations

- The PE report is structural analysis, not full x86 disassembly or completed reverse engineering.
- The file scanner does not parse game assets yet.
- No player, world renderer, physics, vehicle AI, mission interpreter, audio engine or save system is implemented here yet.
- No claim of full-game compatibility is made until the corresponding systems pass tests against the user's legitimate local game data.

Never add proprietary game assets or executable files to this repository.
