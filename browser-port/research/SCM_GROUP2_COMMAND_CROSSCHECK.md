# Group 2 SCM command cross-check against the supplied executable

## Why this table exists

The static dispatch table gives machine-code handler addresses, but an address alone does not identify the command. This note cross-checks a selected set of group-2 commands against a community copy of San Andreas `SASCM.INI` and compares the documented total parameter count with the original executable's input operand decoder and output destination writer.

Sanny Builder's documentation says an SCM opcode definition line has the form `xxxx=N, description`, where `N` is the command parameter count; it identifies `data\\sa\\SASCM.INI` as the legacy San Andreas opcode-definition file. The official Sanny Builder documentation also distinguishes GTA SA v1.0's standard edit mode from other versions/modes. The community file used for the comparison is a useful cross-check, not proof that every copied definition exactly matches this executable's unidentified patch/release.

## Confirmed structure

- Opcode group 2 handler: `0x00469410`.
- Input operand decoder: `0x00464100`.
- Output destination writer: `0x004643F0`.
- Per-thread instruction pointer: record offset `+0x14`.
- Input/result scratch area: begins at `0x00A462F8`.

The count check is `documented parameters = binary input operands + binary output destinations`. The executable's VM handles input arguments and result destinations through separate routines.

## Selected commands

| Opcode | Documented command | Total parameters | Binary inputs | Binary outputs | Handler VA | Count check |
|---:|---|---:|---:|---:|---:|---|
| `0x00D6` | if | 1 | 1 | 0 | `0x0046944F` | PASS |
| `0x00D7` | create_thread | 1 | 1 | 0 | `0x004694BA` | PASS |
| `0x00D8` | mission_cleanup | 0 | 0 | 0 | `0x004694DE` | PASS |
| `0x00D9` | actor car add to mission cleanup | 2 | 1 | 1 | `0x004694FD` | PASS |
| `0x00DB` | actor in_car | 2 | 2 | 0 | `0x00469629` | PASS |
| `0x00DD` | actor driving_car_with_model | 2 | 2 | 0 | `0x0046968E` | PASS |
| `0x00DF` | actor driving | 1 | 1 | 0 | `0x004696E7` | PASS |
| `0x00E1` | player pressed_key | 2 | 2 | 0 | `0x00469738` | PASS |
| `0x00E2` | get_player key state_to | 3 | 2 | 1 | `0x00469795` | PASS |
| `0x0107` | create_object | 5 | 4 | 1 | `0x004697EF` | PASS |
| `0x0108` | destroy_object | 1 | 1 | 0 | `0x00469942` | PASS |
| `0x0109` | player money change | 2 | 2 | 0 | `0x004699A2` | PASS |
| `0x010A` | player money greater-than test | 2 | 2 | 0 | `0x004699CE` | PASS |
| `0x010B` | get player money | 2 | 1 | 1 | `0x00469A0A` | PASS |
| `0x010D` | set_player wanted_level | 2 | 2 | 0 | `0x00469A3B` | PASS |
| `0x010E` | set_player minimum_wanted_level | 2 | 2 | 0 | `0x00469A68` | PASS |
| `0x010F` | player wanted_level greater-than test | 2 | 2 | 0 | `0x00469A95` | PASS |
| `0x0110` | clear_player wanted_level | 1 | 1 | 0 | `0x00469AD2` | PASS |
| `0x0111` | set_wasted_busted_check | 1 | 1 | 0 | `0x00469AFB` | PASS |
| `0x0112` | wasted_or_busted | 0 | 0 | 0 | `0x00469B1B` | PASS |
| `0x0114` | set_actor weapon add_ammo | 3 | 3 | 0 | `0x00469B28` | PASS |
| `0x0117` | player wasted | 1 | 1 | 0 | `0x00469B5E` | PASS |
| `0x0118` | actor dead | 1 | 1 | 0 | `0x00469B93` | PASS |
| `0x0119` | car wrecked | 1 | 1 | 0 | `0x00469BED` | PASS |
| `0x0122` | player pressing_horn | 1 | 1 | 0 | `0x00469C51` | PASS |
| `0x0129` | create_actor_pedtype_in_car_driverseat | 4 | 3 | 1 | `0x00469CBA` | PASS |

## Notable input/output matches

- `0x00D9`: two documented parameters; the handler decodes one input and writes one returned destination.
- `0x00E2`: three documented parameters; the handler decodes two inputs and writes one result destination. This matches `get_player ... key ... state_to ...`.
- `0x0107`: five documented parameters; the handler decodes four inputs (model and position values), creates an object, and writes one handle.
- `0x010B`: two documented parameters; the handler decodes one player input and writes one money result.
- `0x0129`: four documented parameters; the handler decodes three creation inputs and writes one actor handle.

These examples independently confirm the VM's split between input operands and output destinations.

## Caveats

1. This is a selected subset, not all 84 group-2 opcode routes or all 27 opcode groups.
2. Most command labels are from the community SASCM.INI copy; binary behavior descriptions are based on visible instructions in the supplied executable. A parameter-count match does not prove every side effect is identical in every retail patch.
3. `0x0109` is labelled as a money operation. The copied legacy definition says assignment, while the examined binary visibly adds an operand to a per-player memory field. The exact command label/semantics are therefore marked version-sensitive rather than silently reconciled.
4. Some helper routines may contain further indirect calls into `.dev1`; those paths were not followed or bypassed.
5. No game files were modified. No Rockstar assets are included in the repository.

## References

- Sanny Builder, [Opcodes List (SCM.INI)](https://docs.sannybuilder.com/edit-modes/opcodes-list-scm.ini.md): file name and fixed parameter-count definition format.
- Sanny Builder, [Opcodes](https://docs.sannybuilder.com/language/instructions/opcodes): command/parameter encoding and condition grouping.
- Community reference: [CleoDecompiler test SASCM.INI](https://github.com/sr-tream/CleoDecompiler/blob/master/tests/Files%20for%20tests/SASCM.INI), used only for command names and parameter counts.

Full machine address routes remain in `SCM_DISPATCH_MAP.json`; this selected cross-check is in `SCM_GROUP2_COMMAND_CROSSCHECK.json`.
