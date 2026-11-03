# First call trace from the supplied GTA San Andreas PC executable

**Target:** the user-supplied `gta_sa.exe` (15,806,464 bytes; SHA-256 `af63c3b85c5a30a1fb4318ede6add911933ccc63ddac2f57eb63b7fbe212b8e2`).

**Method:** static PE inspection and x86 disassembly with GNU `objdump`. No instructions were run. No code was patched, injected, emulated, unpacked, or used to bypass SecuROM.

## 1. Entry point and early runtime setup

The PE entry point is VA `0x00825330` (RVA `0x00425330`). Its first instructions do not enter the 3D/gameplay loop. They perform Windows/C-runtime setup:

| Address | Observed evidence | Conservative interpretation |
|---|---|---|
| `0x00825330` | Calls imported `GetVersionExA`; stores OS-version fields in globals. | Reads the Windows version. |
| `0x0082539A` | Calls imported `GetModuleHandleA(NULL)` and checks MZ/PE signatures plus optional-header magic and COM descriptor directory. | Validates current process image/module metadata. |
| `0x0082D99B` | Calls KERNEL32 IAT VA `0x008591AC` (`HeapCreate`); stores returned handle in a global. | Creates the process' private heap. |
| `0x00828615` | Calls `TlsAlloc`, `TlsSetValue`, and `GetCurrentThreadId` through KERNEL32 IAT entries. | Sets up thread-local storage for the initial thread. |
| `0x0082D404` | Walks a small function-pointer table and calls non-null entries. | Looks like C/C++ static-initializer startup; not a mapped GTA subsystem. |
| `0x0082D5E3` | Allocates a table, calls `GetStartupInfoA`, and examines standard handles/file types. | C-runtime startup/standard-I/O initialization. |

## 2. Candidate application entry and message loop

The entry-point wrapper calls VA `0x00748FE0` after OS/runtime initialization and command-line setup. Its body contains stronger application-level evidence:

- It reads process command-line arguments and performs several initialization calls.
- It calls code associated with process/window state and global application objects.
- It reaches USER32 message APIs through the import address table: `PeekMessageA` at IAT VA `0x008592BC`, `TranslateMessage` at `0x008592C4`, and `DispatchMessageA` at `0x008592C0`.
- The loop branches on an application-state global at `0x00C8FC80`, dispatches state-dependent internal routines, and repeats through the message-pump path. One idle/error path calls `Sleep(100)`.

**Finding:** `0x00748FE0` is a strong candidate for the top-level Windows application/WinMain-style routine and its state/message loop. The code viewed so far does not identify which state handler performs the actual world update, rendering, simulation or mission tick. Those handlers still need to be traced.

## 3. Direct3D 9 dynamic-loading evidence

The normal PE import table does not list `d3d9.dll`. It does import `LoadLibraryA`, `GetModuleHandleA`, and `GetProcAddress`, and the binary contains `d3d9.dll`, `D3D9.DLL`, `Direct3DCreate9`, and RenderWare D3D9 pipeline strings.

At VA `0x007737CC`, the code:
1. calls `GetModuleHandleA` with a pointer to the `d3d9.dll` string at VA `0x0087B744`;
2. if the module is not already loaded, calls `LoadLibraryA` with that same name;
3. calls `GetProcAddress` using the string at VA `0x0087B724`, which is `Direct3DShaderValidatorCreate9`;
4. invokes the returned function pointer and then calls further internal routines.

A similar dynamic-load pattern occurs at VA `0x007B3C97`.

**Important distinction:** the specific call site above resolves `Direct3DShaderValidatorCreate9`, not `Direct3DCreate9`. The latter string is also present in the executable, but its exact cross-reference/call site has not yet been established. This is evidence of dynamic D3D9 module/export use, not a complete D3D device-creation map.

## 4. Browser-port implications

- Replace the Win32 entry/window/message loop with the browser event loop, canvas, keyboard/mouse/gamepad input, visibility and resize events.
- Replace private heap/TLS and Win32 process/file/thread facilities with browser-compatible memory, workers and local-file abstractions where game behaviour needs them.
- Replace the D3D9/RenderWare presentation backend with a new browser graphics backend. Native D3D9 calls cannot be copied directly into WebGL/WebGPU.
- Continue identifying application-state handlers and RenderWare/game systems they invoke before claiming the frame loop or gameplay code has been reconstructed.

## 5. Next reverse-engineering targets

1. Trace the state-dispatch table and internal calls reached from `0x00748FE0` to find the stable update/render path.
2. Find D3D9 device and swap-chain setup, then map RenderWare pipeline initialization separately from game world/player code.
3. Follow imports and string cross-references for file/archive streaming (`GTA3.IMG`, `GTA_INT.IMG`, `PLAYER.IMG`, `GTA.DAT`, `MAIN.SCM`, `HANDLING.CFG`, `TIMECYC.DAT`).
4. Identify high-confidence engine routines for streaming, world/entity traversal, camera, player/ped, vehicles, audio and script dispatch.
5. Treat every address as specific to this exact binary hash; do not apply the `gta-reversed` Compact-build address map.

## Status and confidence

This is the first function/call trace, not a complete reverse-engineered engine map. Startup/runtime interpretations are supported by direct imported-API calls. `0x00748FE0` is a high-confidence application-loop candidate based on message-pump and state-dispatch structure, but its precise name and gameplay state handlers remain unconfirmed.
