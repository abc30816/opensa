# Static map of the GTA San Andreas SCM command engine

## Target and method

- Executable: supplied `gta_sa.exe`
- SHA-256: `af63c3b85c5a30a1fb4318ede6add911933ccc63ddac2f57eb63b7fbe212b8e2`
- PE32/i386, image base `0x00400000`
- Method: static PE mapping and x86 disassembly; no code execution, emulation, injection, patching, unpacking or copy-protection bypass. Analysis stops at indirect transfers into `.dev1`.

## Generic command fetch

At VA `0x00469F32`, code increments a 16-bit counter, reads a 16-bit opcode from the script-thread instruction pointer at object offset `+0x14`, advances the pointer by two bytes, separates its high bit into a thread flag at `+0xD2`, divides the remaining opcode by 100, and calls the selected group handler through the table at `0x008A7450`.

## Top-level group table

The table contains 27 handler pointers followed by sentinel `0x0000FFFF`. Group index is opcode / 100.

| Group | Range | Handler VA |
|---:|---:|---:|
| 0 | 0000–0063 | 00465EE0 |
| 1 | 0064–00C7 | 00466E60 |
| 2 | 00C8–012B | 00469410 |
| 3 | 012C–018F | 0047C180 |
| 4 | 0190–01F3 | 0047D290 |
| 5 | 01F4–0257 | 0047E110 |
| 6 | 0258–02BB | 0047F3F0 |
| 7 | 02BC–031F | 0047FAB0 |
| 8 | 0320–0383 | 00481380 |
| 9 | 0384–03E7 | 00483C50 |
| 10 | 03E8–044B | 00489580 |
| 11 | 044C–04AF | 0048A3A0 |
| 12 | 04B0–0513 | 0048B610 |
| 13 | 0514–0577 | 0048CE50 |
| 14 | 0578–05DB | 0048EB20 |
| 15 | 05DC–063F | 00490E30 |
| 16 | 0640–06A3 | 00494060 |
| 17 | 06A4–0707 | 00496E80 |
| 18 | 0708–076B | 0046D0D0 |
| 19 | 076C–07CF | 0046B4E0 |
| 20 | 07D0–0833 | 00472390 |
| 21 | 0834–0897 | 00470B10 |
| 22 | 0898–08FB | 00474980 |
| 23 | 08FC–095F | 00476350 |
| 24 | 0960–09C3 | 00478080 |
| 25 | 09C4–0A27 | 0047A7E0 |
| 26 | 0A28–0A8B | 00479E20 |

## Groups 0 and 1

| Group | Handler | Direct table | Entries | Unique destinations | Shared fallback |
|---:|---:|---:|---:|---:|---:|
| 0 | 00465EE0 | 00466CD0 | 100 | 86 | 00466CBA (15 table opcodes) |
| 1 | 00466E60 | 004683E4 | 97 (0064–00C4) | 82 | 004683CF (15 table opcodes plus out-of-range 00C5–00C7) |

Disassembly of several group-1 destinations shows integer and floating-point arithmetic operations reading operands and writing results via script variables. Command names are intentionally not guessed.

## Group 2

Handler at `0x00469410` has a translated dispatch table of 84 opcode values `0x00D6–0x0129` (bytes at `0x00469ECC`) and 30 pointer destinations (at `0x00469E54`). 39 IDs share fallback `0x00469E3D`; the others route to 29 distinct non-fallback destinations. The fallback sets `AL=0xFF`; its higher-level meaning is not proven.

## Input operand decoder

Function `0x00464100` reads an operand count, consumes one type byte per argument and normalizes the results into four-byte scratch slots starting at `0x00A462F8`. Its eight-entry type table is at `0x004642A4`:

| Tag | Handler | Observed shape |
|---:|---:|---|
| 1 | 0046413D | Four-byte raw immediate |
| 2 | 0046414F | 16-bit offset into global script variable area at 00A4BFE0 |
| 3 | 0046416B | Indirect transfer through .dev1; stop point |
| 4 | 00464194 | Signed 8-bit immediate |
| 5 | 004641A7 | Signed 16-bit immediate |
| 6 | 0046413D | Shares tag 1 reader; semantic distinction not identified |
| 7 | 004641BB | Multiword indexed-variable descriptor, global/local branches |
| 8 | 0046421C | Related multiword indexed-variable form |

## Output destination/write-back

Routine `0x004643F0` receives an output count and reads one destination type byte per result. Type 1 uses default path `0x00464549`; tags 2–8 use the seven-entry table at `0x0046455C`:

| Tag | Handler | Observed shape |
|---:|---:|---|
| 1 | 00464549 | Default/direct-local path |
| 2 | 0046442F | 16-bit offset into global variable area |
| 3 | 0046444B | Thread-local/indexed mode branch |
| 4 | 00464549 | Shared default |
| 5 | 00464549 | Shared default |
| 6 | 00464549 | Shared default |
| 7 | 00464474 | Multiword indexed destination |
| 8 | 004644D5 | Related multiword indexed destination |

One indexed write-back branch jumps through `0x014BA2A4` in `.dev1` and is not followed.

## Main script loading

At VA `0x00468F35`, the game constructs `data\\script\\main.scm`, opens it in `rb` mode, reads `0x30D40` (200,000) bytes into memory at `0x00A4BFE0`, and closes the stream. This is the observed read at this location, not proof that the entire file is loaded there.

## Limits and next work

This proves structural parts of the SCM VM—fetch/group dispatch, a portion of the handler maps, typed input decoding and typed output storage. It does **not** reconstruct the full VM or prove command semantics. Still needed: map remaining 26 group implementations, scheduler/thread lifecycle, wait/resume, gosub/return, mission start/cleanup, streamed scripts, and actual local MAIN.SCM/SCRIPT.IMG validation.

Full address and opcode mapping: `SCM_DISPATCH_MAP.json`. Reproducible extractor: `tools/analyze_scm_dispatch.py`.
