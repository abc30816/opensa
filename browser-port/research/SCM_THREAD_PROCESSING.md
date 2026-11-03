# Static trace of GTA San Andreas script-thread processing

## Target and method

- Executable: supplied `gta_sa.exe`
- SHA-256: `af63c3b85c5a30a1fb4318ede6add911933ccc63ddac2f57eb63b7fbe212b8e2`
- Findings come from static x86 disassembly only.
- The EXE was not launched, emulated, injected into, patched, unpacked or modified. Indirect destinations in `.dev1` are not followed.

## Per-thread command runner — VA `0x00469F80`

The routine receives a script-thread record in `ECX` and stores it in `ESI`.

1. It checks the 32-bit field at `+0xD8). If nonzero, it calls `0x004D5F10`. If that returns nonzero, it reconstructs the instruction pointer:
   - negative `+0xD8`: `IP = *(thread + 0x10) - value`
   - nonnegative `+0xD8`: `IP = 0x00A4BFE0 + value`
   Then it clears `+0xD8` and `+0xCC`.
2. If byte `+0xC6` is nonzero, it calls `0x00485AD0`.
3. If byte `+0xDC` and global byte `0x00A46B30` are set, it updates a 16-bit field at `+0x38`. When that reaches one, it clears it and restores `IP` from `+0x18`.
4. It calls helper `0x004703F0`.
5. It compares global `0x00B7F204` with the thread's `+0xCC`. If the global value is smaller, no new command is executed in this pass.
6. Otherwise, a command loop at `0x0046A030` fetches a 16-bit opcode from `+0x14`, advances the cursor by two, stores opcode bit 15 at `+0xD2`, dispatches through the group table at `0x008A7450), and invokes that group handler.
7. If a group handler returns `AL == 0`, it continues with the next command; if nonzero, this pass exits.

This establishes a per-thread update routine that can process multiple commands in one pass and can yield/stop based on handler status or its available update budget. The exact semantics of all status values and helper `0x004D5F10` are not yet established.

## Global script-processing pass — VA `0x0046A080`

This function is called from at least three sites: `0x00440A8D`, `0x0053C467`, and `0x00619725`.

Visible behavior:

- It checks global byte `0x00A45708` and early-returns when it equals one.
- It obtains a frame/time delta using global time value `0x00B7F1D8), constants and helper `0x00822440).
- It resets per-pass counters `0x00A46E74` and `0x00A46E78).
- It calls additional script/environment helper routines, including `0x00465660`, `0x00465700`, `0x00465350`, `0x00481160`, `0x00493A70), and `0x0046CF80`.
- It decays global byte `0x00A46B30) when nonzero.
- It performs one-time table/record initialization when global byte `0x00A471E7` is set.
- It adds the frame delta to globals `0x00A4B060` and `0x00A4B064`, then calls `0x005914D0`.
- It obtains a linked-record head from global pointer `0x00A8DAAC). Each record's link pointer is at offset `+0x00). For each visited record, it adds the frame delta to fields `+0xBC` and `+0xC0), then calls `0x00469F80).
- It checks byte `+0xC4` on the next linked record as part of the continuation test and ends the observed traversal at the list boundary.
- It calls `0x005914D0` again after the thread traversal.

This supports describing `0x0046A080` as a global script-processing/update pass and `0x00469F80` as its per-thread command runner. It does not establish exact source-level class names or every linked-list flag meaning.

## Thread-record offsets observed

| Offset | Observed use | Confidence |
|---:|---|---|
| `+0x00` | Link pointer used to advance the global record traversal | High |
| `+0x10` | Base pointer in the negative resume-offset branch | High |
| `+0x14` | Script instruction pointer, advanced by two for each opcode | High |
| `+0x18` | Cursor restored when `+0x38` reaches its terminal value | High |
| `+0x38` | 16-bit counter updated by a conditional cursor-restore path | High for behavior; semantic label unknown |
| `+0xBC`, `+0xC0` | Accumulators advanced by frame delta in the global pass | High for behavior; units/labels unknown |
| `+0xC4` | Byte used by the linked-record continuation check | High for use; meaning unknown |
| `+0xC5` | Set by one group-2 handler | High for write; meaning unknown |
| `+0xC6` | Byte gates a helper call | High for use; meaning unknown |
| `+0xCC` | Compared with global command/update budget; cleared in resume path | High for use; exact units unknown |
| `+0xD0` | 16-bit field written by a group-2 handler | High for write; meaning unknown |
| `+0xD2` | Receives opcode high bit (bit 15) on command fetch | High |
| `+0xD3` | Boolean byte written by a group-2 handler | High for write; meaning unknown |
| `+0xD4` | Boolean byte read by a group-2 handler | High for read; meaning unknown |
| `+0xD8` | Resume/control value used to reconstruct the script cursor, then cleared | High for use; precise meaning unknown |
| `+0xDC` | Mode byte affects operand-local resolution and cursor-restore logic | High for use; meaning unknown |

## Browser-port implications

A compatible script VM needs more than a switch statement. It needs byte-accurate cursor movement, typed input operand decoding, typed output destination write-back, an ordered update pass over thread records, command yield/continue status, a per-thread update budget, and explicit save/resume/counter state.

The current project maps these structures only. No browser thread scheduler or complete mission interpreter has been implemented.

## Next targets

1. Trace record creation/linking and destruction around global pointer `0x00A8DAAC`.
2. Trace `0x004D5F10`, `0x004703F0), and `0x00485AD0` without following protected indirect destinations.
3. Establish the meaning of `+0xBC`, `+0xC0`, `+0xCC`, `+0xC4`, `+0xD8), and `+0xDC` from writes and consumers.
4. Match each command handler to documented opcode signatures, then validate against the user's local MAIN.SCM and SCRIPT.IMG after the local inspector has been audited.
5. Build deterministic tests for multiple scripts, wait/yield/resume and story mission progression.
