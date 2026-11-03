# Static trace of the GTA San Andreas SCM thread-record lifecycle

## Target and safety

- Executable: supplied `gta_sa.exe`
- SHA-256: `af63c3b85c5a30a1fb4318ede6add911933ccc63ddac2f57eb63b7fbe212b8e2`
- Analysis is limited to ordinary executable code/data sections and static x86 disassembly.
- The original executable was not run, emulated, injected, patched, modified or unpacked. Indirect targets in `.dev1` were not followed.

## 1. Startup creates a fixed pool of thread records

The initializer at VA `0x00468DD0` performs the following visible work:

1. Clears a large script-memory region at `0x00A4BFE0` and a 0x400-dword region at `0x00A4AFE0`.
2. Sets the active-list head global at `0x00A8DAAC` to null.
3. Walks record addresses from `0x00A8DAB0` up to (but not including) `0x00A92EB0`, stepping by `0xE0` bytes.
4. Calls the record initializer at `0x00464960` for each record.
5. Links the records through their first two dword fields and stores the last-created head in a second list-head global at `0x00A8DAA8`.

The range calculation is exact:

- Start: `0x00A8DAB0`
- End (exclusive): `0x00A92EB0`
- Record stride: `0xE0` = 224 bytes
- Number of records: `(0x00A92EB0 - 0x00A8DAB0) / 0xE0 = 96`

The second head at `0x00A8DAA8` is initialized with all 96 records. It is a separate record list from the active list. It is tempting to label it a free-list, but the list-management helpers that would confirm exact pool semantics immediately transfer into `.dev1`; therefore this document calls it the **secondary/pool list** and leaves exact reuse semantics unassigned.

## 2. Record initializer — VA `0x00464960`

The constructor initializes a record passed in `ECX`:

- Copies seven bytes from `0x0085AD44` into the name field at `+0x08`. The bytes spell `noname` followed by a null terminator.
- Clears link fields at `+0x00` and `+0x04`.
- Clears `+0x10` and the instruction cursor at `+0x14`.
- Clears the eight dwords beginning at `+0x18` and the 16-bit field at `+0x38`.
- Clears fields `+0xCC`, `+0xC4` through `+0xC8`, `+0xD0`, `+0xD2`, `+0xD4`, `+0xD8` and `+0xDC`.
- Sets `+0xC9` to `0xFF` and `+0xD3` to `1`.
- Clears 34 dwords beginning at `+0x3C`, covering the region through `+0xC3`.

This is consistent with the same record layout used by the script dispatcher: the instruction pointer is at `+0x14`, the opcode high-bit flag is at `+0xD2`, and the thread resume field is at `+0xD8`.

## 3. Active-list insertion callback — VA `0x0050079F`

The visible callback body does the following:

1. Reads the supplied start cursor from its stack argument and stores it at record offset `+0x14`.
2. Reads the old active head from global `0x00A8DAAC` and stores it at the new record's `+0x00` link.
3. Sets the new record's `+0x04` link to null.
4. If there was an old active head, writes the new record into the old head's `+0x04` link.
5. Stores the new record in global active head `0x00A8DAAC`.
6. Sets byte `+0xC4` to `1`.

This is a confirmed prepend operation on the active doubly linked list. The surrounding control flow passes through a separate indirect thunk at `0x00500720`; this analysis records the visible callback but does not follow the thunk or claim to have recovered the complete allocation/call path.

## 4. Name-based cleanup and destructor call sites

A cleanup routine beginning around VA `0x0048A580` receives a short name, normalizes the supplied eight-byte name to lowercase, then walks the active list at `0x00A8DAAC` using the `+0x00` link. It compares the supplied name with the record name at `+0x08`. When the strings match, it:

- Calls a list-management helper at `0x00464C50` with the active-list head global `0x00A8DAAC` and the matching record.
- Calls another helper at `0x00464C80` with the secondary/pool-list head global `0x00A8DAA8` and that record.
- Calls the record cleanup/destructor at `0x00465B20`.
- Continues to the next record saved before removal.

Two other visible call sites (`0x0046686C` and `0x00474DB1`) use the same helper/destructor sequence. The helpers at `0x00464C50` and `0x00464C80` begin with indirect jumps through pointers in `.dev1`. Their internal behavior is not inspected; this document therefore does not guess whether the second helper returns a slot to a pool, removes it from another registry, or performs some other list operation.

The destructor at `0x00465B20` visibly clears the record's active byte at `+0xC4`, branches on state/type byte `+0xC9`, and performs associated entity/resource cleanup. It is not a complete source-level destructor reconstruction.

## 5. Confirmed record field map

| Offset | Evidence-backed role |
|---:|---|
| `+0x00` | First list link; active-thread traversal follows this pointer. |
| `+0x04` | Second list link; active-list insertion updates the old head through this field. |
| `+0x08` | Short thread/script name; initialized to `noname`, compared by name-based cleanup. |
| `+0x14` | Script instruction pointer; dispatcher fetches opcodes here; insertion callback sets initial cursor here. |
| `+0xC4` | Active marker; constructor/destructor clear it, insertion sets it. |
| `+0xC5` | Used by opcode/command handling; full semantic name unknown. |
| `+0xC6` | Gates a helper during per-thread processing. |
| `+0xC7` | Read by cleanup/save-related code; precise meaning unknown. |
| `+0xC9` | State/type byte used by destructor branching; default is `0xFF`. |
| `+0xCC` | Per-thread value compared with a global processing budget. |
| `+0xD0` | 16-bit command field written by the `if` handler. |
| `+0xD2` | Receives opcode bit 15 at command fetch. |
| `+0xD3` | Initialized to `1`; later modified by handlers. |
| `+0xD4` | Read by command handling; precise meaning unknown. |
| `+0xD8` | Resume/control value used to reconstruct the instruction cursor. |
| `+0xDC` | Mode byte affects operand/local-variable resolution. |

## 6. Browser-port implications and limits

A browser SCM runtime needs a thread-record pool, active-thread scheduling, name-based cleanup, byte-accurate instruction cursors, and a clear separation between active and secondary record lists. The observed 96-record pool size and record stride can inform compatibility tests for this exact executable.

However, the exact pool-slot allocation/recycling behavior is not yet established because the decisive list helpers are protected indirect transfers into `.dev1`. The original `create_thread` opcode handler at `0x004694BA` also calls an indirect helper at `0x00464CA0` whose destination is in `.dev1`. These are explicit stopping points. The browser implementation must reconstruct behavior from the public SCM format and observable state, not bypass those protected paths.

The current project has **not** implemented a browser script scheduler or mission VM. This document is static reverse-engineering evidence only.
