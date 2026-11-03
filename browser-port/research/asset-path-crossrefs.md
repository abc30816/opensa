# Cross-references from GTA SA executable strings to asset/configuration code

**Target:** the supplied `gta_sa.exe` (15,806,464 bytes; SHA-256 `af63c3b85c5a30a1fb4318ede6add911933ccc63ddac2f57eb63b7fbe212b8e2`).

**Method:** static x86 disassembly and string-reference analysis using GNU `objdump`. The executable was not run. Analysis stops at indirect transfers into the unusual `.dev1` region; no protected code was followed, unpacked, or bypassed.

## 1. Observed asset/configuration paths

| Path string | String VA | Code reference / observation | Confidence and boundary |
|---|---:|---|---|
| `MODELS\\GTA3.IMG` | `0x00859AF4` | References at `0x00406C2A` and `0x0040847C` pass the path to `0x004067B0`. | High-confidence archive-path use. `0x004067B0` immediately jumps through pointer `0x014BB1A8` into `.dev1`; trace stops there. |
| `MODELS\\GTA_INT.IMG` | `0x00859B20` | At `0x005B9922`, code compares a parsed path field against this constant before deciding how to process the record. | High-confidence path comparison; the containing table/record semantics need more work. |
| `MODELS\\PLAYER.IMG` | `0x00868184` | References at `0x005A4975`, `0x005A71C8`, `0x005A88CA`; nearby code calls `0x005327F0`. | High-confidence player archive-path use. `0x005327F0` immediately jumps through pointer `0x014BB82C` into `.dev1`; trace stops there. |
| `DATA\\GTA.DAT` | `0x00864B38` | At `0x0053E3BF`, code passes the path to `0x0053C120`. Another reference near `0x0045EC53` also transfers to `0x0053C120`. | High-confidence file reference. `0x0053C120` immediately jumps through pointer `0x014BAF7C` into `.dev1`; trace stops there. |
| `TIMECYC.DAT` | `0x0086B7C0` | At `0x005BC2B9`, code opens the named file through a normal helper and enters a visible row/field parsing routine beginning at `0x005BC2A0`. | High-confidence time-cycle configuration parser candidate. Detailed field semantics still need cross-checking against the user's local file. |
| `HANDLING.CFG` | `0x0086B9AC` | At `0x005BE02B`, code opens the named file and enters a visible parser beginning at `0x005BE010`. | High-confidence handling configuration parser candidate. Record layout/field semantics need validation against local file and reference docs. |

## 2. Time-cycle parser candidate (`0x005BC2A0`)

Evidence visible in the ordinary code region:

- The function passes the `TIMECYC.DAT` string at `0x0086B7C0` to a file-open helper (`0x00538DA0`). That helper's first instruction is a direct jump to `0x00824098`, which remains within the ordinary PE code section.
- It iterates an outer counter initialized to `0x17` (23), plus an inner counter initialized to `8`.
- It skips candidate lines whose first byte is `/` and advances through a line-reader helper at `0x00537420`.
- It passes a long list of destination pointers and a format string at `0x0086B720` to a shared scanning/parsing routine at `0x008229AD`.
- Parsed bytes and floating-point values are written into repeated global tables, with repeated offsets separated by `0xB8` bytes in the visible stores.

This strongly supports that the routine loads a table-like time/environment configuration from `TIMECYC.DAT`. It does not yet identify every field, weather slot, colour component or conversion rule. Do not assign semantic names to individual offsets until the data file is available and values can be matched.

## 3. Handling parser candidate (`0x005BE010`)

Evidence visible in the ordinary code region:

- The function opens the string `HANDLING.CFG` at `0x0086B9AC` through the same ordinary file-open helper (`0x00538DA0` → `0x00824098`).
- It repeatedly gets text rows through helper `0x00537420` and dispatches based on row-leading characters (including `!`, `$`, `%`) and parsed token/field counts.
- The visible code converts textual values through helper `0x00824AAE` and stores floating-point results at successive offsets from `+0x04` through at least `+0x54` in a record referenced by `ESI`.
- One visible record allocation/lookup path uses a stride of `0x58` bytes (`0x005BE23A` multiplies an index by `0x58`).

This strongly supports a parser for the `HANDLING.CFG` vehicle-handling records. The precise mapping of each field to mass, traction, braking, gears, steering, suspension and other semantics has not been completed. It must be validated against the actual local file rather than guessed from field order.

## 4. Protection / redirection stop points

These ordinary code locations transfer into `.dev1` through indirect pointers:

- `0x004067B0` → pointer at `0x014BB1A8` (GTA3.IMG path helper)
- `0x005327F0` → pointer at `0x014BB82C` (PLAYER.IMG-related helper)
- `0x0053C120` → pointer at `0x014BAF7C` (GTA.DAT-related helper)
- `0x005BC290` and other adjacent stubs contain direct branches into `.dev1` as well

The report intentionally does not inspect those destinations or attempt to resolve their runtime contents. The exact relationship of every thunk to SecuROM is not proven, but their destinations are in the unusual `.dev1` section and the executable also contains SecuROM-related resources/strings. These are hard stop points for this analysis.

## 5. Browser-port use

The visible parser shapes can inform independently written readers for `TIMECYC.DAT` and `HANDLING.CFG`. The browser implementation should read the user's local originals through a bounded, read-only file interface and parse data independently. It should not reuse fixed addresses from this executable, copy protected machine code, or require the retail EXE to run in the browser.

## 6. Current status

- Main application loop candidate and its 10-state dispatch table: mapped at a preliminary level.
- `TIMECYC.DAT` parser candidate: identified at function-level evidence; semantic field map incomplete.
- `HANDLING.CFG` parser candidate: identified at function-level evidence; semantic field map incomplete.
- IMG and GTA.DAT loader call sites: identified, but visible call paths are redirected into `.dev1`; no attempt to bypass or unpack them.
- Full gameplay update/render, player, vehicle, world streaming and SCM mission functions: not yet mapped.
