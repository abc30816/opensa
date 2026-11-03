# State dispatch from the GTA SA executable's application loop

The candidate application routine at VA `0x00748FE0` reads an application-state global at `0x00C8FC80`. It bounds-checks the value to 0–9, then jumps through a ten-entry table at VA `0x007497FC`.

| State | Handler address |
|---:|---:|
| 0 | `0x00749388` |
| 1 | `0x007493F7` |
| 2 | `0x0074941C` |
| 3 | `0x007494CE` |
| 4 | `0x0074941C` (same target as 2) |
| 5 | `0x00749512` |
| 6 | `0x0074956A` |
| 7 | `0x007495A9` |
| 8 | `0x007495F6` |
| 9 | `0x00749624` |

The handlers call several routines in different code ranges. Their gameplay meanings have not yet been established, so the state values and handler addresses are recorded without guessing labels such as menu, gameplay or mission.

This is a useful next boundary for tracing the actual frame/update path. The next pass must follow calls made by each state handler and distinguish UI/window state, streaming, simulation, rendering and script execution.
