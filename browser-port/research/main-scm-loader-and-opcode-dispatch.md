# MAIN.SCM loading and script-command dispatch — static reverse-engineering trace

## Target and safety

- Executable: user-supplied `gta_sa.exe`
- Size: 15,806,464 bytes
- SHA-256: `af63c3b85c5a30a1fb4318ede6add911933ccc63ddac2f57eb63b7fbe212b8e2`
- Analysis: GNU `objdump` disassembly plus static cross-reference inspection.
- The executable was not launched, emulated, injected into, unpacked, patched or modified. No copy-protection bypass was attempted.

## 1. Main script file setup and read

At VA `0x00468F35`, the code builds a path prefix from the string at VA `0x0085AD6C` (the `data\\script` directory). It then:

1. Uses the string at `0x0085AD60` (`main.scm`) as the filename.
2. Uses the string at `0x0085AC6C` (`rb`) as the open mode.
3. Calls `0x00538DA0`, whose wrapper leads to the ordinary file-stream helper at `0x00824098`.
4. Passes the returned stream handle to `0x00538DF0`, together with destination address `0x00A4BFE0` and byte count `0x00030D40` (200,000 bytes).
5. Calls `0x00538E70`, which leads to the stream-close routine at `0x00823F4B`.

The disassembly therefore directly supports this statement: **the program opens `data\\script\\main.scm` in binary-read mode, reads 200,000 bytes into `0x00A4BFE0`, and closes the stream.** It does not show a read of the entire MAIN.SCM file at this site.

The same address region is subsequently used by script-operand resolution code as a data/variable backing area. The exact file-format meaning of every byte in this initial 200,000-byte region has not yet been assigned, so it is deliberately not labelled as the entire script program or the whole global-variable table.

## 2. Script-thread instruction pointer and operand decoding

The script-command dispatcher at VA `0x00469410` uses the incoming object pointer in `ECX` and keeps it in `ESI`.

Multiple handlers and the operand reader at VA `0x00464100` access a pointer at object offset `+0x14`:

- Read a byte/word/dword from the address held at `[ESI+0x14]`.
- Advance the pointer by the consumed operand width.
- Write the updated pointer back to `[ESI+0x14]`.
- Resolve some encoded values through the script data area at `0x00A4BFE0`; other cases resolve thread-local values or indirect references.

This is strong structural evidence of a running script/thread object with a bytecode cursor and operand decoding. The exact full C++ class layout has not been reconstructed.

## 3. Opcode dispatch range

At VA `0x00469431`, the dispatcher computes:

`opcodeIndex = opcode - 0x00D6`

It checks that the result is no greater than `0x53` (83), reads a byte from a 0x54-byte translation table at `0x00469ECC`, and uses that byte to select a 32-bit handler address from the jump table at `0x00469E54`.

This covers **84 opcode values: `0x00D6` through `0x0129` inclusive**.

The table maps those 84 values to 30 distinct handler destinations. Thirty-nine values share the common fallback path at `0x00469E3D`; the other 45 values are routed to handler addresses grouped below. The fallback returns a distinct `AL=0xFF` value; ordinary successful handler exits observed in this routine commonly clear `AL`. The semantic meaning of that return convention is not yet established, so the fallback is not labelled “unimplemented” or “no-op”.

### Opcode-to-handler map

| Opcode(s) | Handler VA |
|---|---:|
| `00D6` | `0046944F` |
| `00D7` | `004694BA` |
| `00D8` | `004694DE` |
| `00D9` | `004694FD` |
| `00DA, 00DC, 00DE, 00E0, 00E3–00EB, 00F5–00FD, 0113, 0115–0116, 011A–0121, 0123–0128` | `00469E3D` (shared fallback) |
| `00DB` | `00469629` |
| `00DD` | `0046968E` |
| `00DF` | `004696E7` |
| `00E1` | `00469738` |
| `00E2` | `00469795` |
| `00EC–00F1, 00FE–0103` | `004697D1` |
| `00F2–00F4, 0104–0106` | `004697E0` |
| `0107` | `004697EF` |
| `0108` | `00469942` |
| `0109` | `004699A2` |
| `010A` | `004699CE` |
| `010B` | `00469A0A` |
| `010C` | `00469E39` |
| `010D` | `00469A3B` |
| `010E` | `00469A68` |
| `010F` | `00469A95` |
| `0110` | `00469AD2` |
| `0111` | `00469AFB` |
| `0112` | `00469B1B` |
| `0114` | `00469B28` |
| `0117` | `00469B5E` |
| `0118` | `00469B93` |
| `0119` | `00469BED` |
| `0122` | `00469C51` |
| `0129` | `00469CBA` |

A useful external cross-check: Sanny Builder's published San Andreas scripting references represent opcodes as four-digit hexadecimal IDs; its examples include `00D6: if`. That independently confirms the numeric opcode notation, but does not by itself identify every handler's exact behaviour. See the Sanny Builder opcode documentation and library linked in the research notes.

## 4. What this proves — and what it does not

### Proven from this executable's ordinary code

- The program opens and reads from `data\\script\\main.scm`.
- A 200,000-byte block is read into `0x00A4BFE0` at this initialization site.
- A script-like object carries a byte cursor at offset `+0x14`.
- Parameter decoding advances that cursor and resolves encoded values from memory.
- A command dispatcher performs table-based dispatch for opcode values `0x00D6–0x0129`.
- Several opcode values share handler routines; many in this range use one shared fallback route.

### Not yet proven / still to map

- The meaning of every opcode handler and its complete parameter signature.
- The rest of the opcode ranges outside `0x00D6–0x0129`.
- Thread scheduling, waits, gosubs, mission start/finish and streamed-script lifecycles.
- How mission command handlers call into ped, vehicle, world, camera, audio and UI systems.
- The full loading/decoding of MAIN.SCM and SCRIPT.IMG.
- Whether this particular executable's script behavior exactly matches the standard SA PC 1.0 scripting definitions.

## 5. Next reverse-engineering tasks

1. Map every other opcode dispatcher/range and the common operand decoder.
2. Identify thread scheduling and mission lifecycle functions from the script-thread object and calls into the dispatcher.
3. Decode the user's local MAIN.SCM and SCRIPT.IMG later, using bounded read-only parsing, to compare real mission instructions against the function map.
4. Name individual handlers only after matching their argument decoding, called functions and documented command semantics.
5. Port the resulting behavior into a new browser script VM. Keep all machine addresses specific to this exact executable hash; do not reuse fixed addresses from the incompatible Compact binary.

This is a significant first map of the original game's mission-script execution path. It is not a completed script engine or a playable browser build.
