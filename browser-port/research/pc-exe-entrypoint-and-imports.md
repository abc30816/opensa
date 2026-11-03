# Static findings from the supplied GTA San Andreas PC executable

## Input and safety

- File: `gta_sa.exe`
- Size: 15,806,464 bytes
- SHA-256: `af63c3b85c5a30a1fb4318ede6add911933ccc63ddac2f57eb63b7fbe212b8e2`
- Format: PE32 / Intel 80386
- Preferred image base: `0x00400000`
- Entry point VA: `0x00825330`
- Sections: 11

The executable was inspected as data only. It was not launched, emulated, patched, injected into, unpacked or modified. No SecuROM/copy-protection bypass was attempted.

## Entry-point excerpt

GNU objdump disassembly at VA `0x00825330` shows early startup work:

- It allocates/prepares an OS version information structure and calls the imported `GetVersionExA` through the import address table, then copies OS version fields to global memory.
- It obtains the current module handle through `GetModuleHandleA(NULL)`.
- It checks for an MZ header, locates and checks the PE signature, tests the PE32/PE32+ optional-header magic, and checks the COM descriptor data-directory entry.
- It then calls internal routines at addresses including `0x0082D99B`, `0x00828615`, `0x0082D404` and `0x0082D5E3`.

This is startup/module-validation code. The excerpt does **not** identify the main gameplay loop, renderer loop or mission engine. The internal calls are not yet named.

## Imported libraries observed by `objdump -p`

- `WINMM.dll`: `timeGetTime`, `timeBeginPeriod`, `timeEndPeriod`, `timeGetDevCaps`.
- `vorbisfile.dll`: Ogg/Vorbis stream operations including `ov_open_callbacks`, `ov_read`, `ov_time_seek`, `ov_clear`.
- `WS2_32.dll`: Winsock imports by ordinal.
- `EAX.DLL`: import by ordinal.
- `KERNEL32.dll`: file I/O, file enumeration, file mapping, threads, semaphores, critical sections, memory and performance counters.
- `USER32.dll`: window creation/management, message pump, keyboard state, cursor capture and message dispatch.
- `GDI32.dll`, `ADVAPI32.dll`, `ole32.dll`: additional Windows platform dependencies.

No `d3d9.dll` import appears in the static import table. The executable does contain `d3d9.dll` and `Direct3DCreate9` strings alongside `LoadLibraryA` and `GetProcAddress` imports, consistent with dynamic loading of Direct3D 9. This is an observation, not a complete renderer call map.

## RenderWare evidence in strings

The executable contains embedded RenderWare SDK source-path strings from the RW36 tree, including D3D9 world/atomic pipelines, lighting, frame/matrix, texture, skin, animation and audio-related modules. It also contains strings such as:

- `MODELS\\GTA3.IMG`, `MODELS\\GTA_INT.IMG`, `MODELS\\PLAYER.IMG`
- `DATA\\GTA.DAT`, `DATA\\SCRIPT\\MAIN.SCM`
- `TIMECYC.DAT`, `HANDLING.CFG`
- `D3D9.DLL`, `Direct3DCreate9`

These strings help locate subsystem/data references but do not by themselves reveal the code that uses them.

## Immediate reverse-engineering next steps

1. Build a disassembly index for the executable's actual code sections, keeping file offsets and virtual addresses separate.
2. Map references to imported Win32/D3D9/audio/file functions and to known asset/configuration strings.
3. Identify and name startup, streaming, renderer, world, collision, player, vehicle, audio and script routines using cross-references and independently documented behaviour.
4. Validate candidate functions against this exact binary; do not transplant fixed addresses from a different executable.
5. Keep protected loader/DRM code outside the porting effort. Reimplement interoperable engine behaviour; do not defeat copy protection.

## Current status

This is a first targeted static-disassembly pass, not a complete reverse-engineered function map. No executable instruction has been run.
