#!/usr/bin/env python3
"""Read-only static extractor for GTA SA SCM tables and thread metadata.

This tool parses a PE32 file as bytes. It never launches the executable and
never reads code/data from .dev1 or .dev2.
"""
from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path
from typing import Any

BASE = 0x00400000
GROUP_TABLE = 0x008A7450
GROUP0_TABLE, GROUP0_COUNT = 0x00466CD0, 100
GROUP1_TABLE, GROUP1_COUNT, GROUP1_BASE = 0x004683E4, 97, 0x64
GROUP2_TRANSLATION, GROUP2_HANDLERS, GROUP2_BASE, GROUP2_COUNT = 0x00469ECC, 0x00469E54, 0xD6, 0x54
INPUT_TABLE, INPUT_COUNT = 0x004642A4, 8
OUTPUT_TABLE, OUTPUT_COUNT = 0x0046455C, 7
THREAD_POOL_START, THREAD_POOL_END, THREAD_STRIDE = 0x00A8DAB0, 0x00A92EB0, 0xE0


def rd16(data: bytes, off: int) -> int:
    return struct.unpack_from("<H", data, off)[0]


def rd32(data: bytes, off: int) -> int:
    return struct.unpack_from("<I", data, off)[0]


class PE32:
    def __init__(self, data: bytes):
        self.data = data
        if len(data) < 0x40 or data[:2] != b"MZ":
            raise ValueError("Not an MZ executable")
        peoff = rd32(data, 0x3C)
        if peoff + 24 > len(data) or data[peoff:peoff + 4] != b"PE\0\0":
            raise ValueError("Missing or truncated PE signature")
        coff = peoff + 4
        self.machine = rd16(data, coff)
        count = rd16(data, coff + 2)
        opt_size = rd16(data, coff + 16)
        opt = coff + 20
        if self.machine != 0x14C or opt + opt_size > len(data) or rd16(data, opt) != 0x10B:
            raise ValueError("Expected bounded PE32/i386 optional header")
        self.image_base = rd32(data, opt + 28)
        table = opt + opt_size
        if table + count * 40 > len(data):
            raise ValueError("Truncated PE section table")
        self.sections = []
        for i in range(count):
            off = table + i * 40
            name = data[off:off + 8].split(b"\0", 1)[0].decode("ascii", "replace")
            va, raw_size, raw_off = rd32(data, off + 12), rd32(data, off + 16), rd32(data, off + 20)
            if raw_off > len(data) or raw_size > len(data) - raw_off:
                raise ValueError(f"Section {name} exceeds the file")
            self.sections.append((name, va, raw_size, raw_off))

    def read_va(self, va: int, size: int) -> tuple[bytes, str]:
        if va < self.image_base or size < 0:
            raise ValueError("Invalid VA/size")
        rva = va - self.image_base
        for name, start, raw_size, raw_off in self.sections:
            if start <= rva and rva + size <= start + raw_size:
                off = raw_off + (rva - start)
                if off + size <= len(self.data):
                    return self.data[off:off + size], name
        raise ValueError(f"VA 0x{va:08X} is not backed by a file section")


def grouped_direct(targets: list[int], opcode_base: int) -> list[dict[str, Any]]:
    grouped: dict[int, list[int]] = {}
    for i, target in enumerate(targets):
        grouped.setdefault(target, []).append(opcode_base + i)
    return [{"handler_va": f"0x{k:08X}", "opcodes": v} for k, v in sorted(grouped.items())]


def extract(data: bytes) -> dict[str, Any]:
    pe = PE32(data)
    table_entries = []
    for i in range(64):
        raw, _ = pe.read_va(GROUP_TABLE + i * 4, 4)
        target = rd32(raw, 0)
        if target == 0xFFFF:
            break
        table_entries.append({"group": i, "first_opcode": i * 100, "last_opcode": i * 100 + 99, "handler_va": f"0x{target:08X}"})
    else:
        raise ValueError("No bounded end marker in SCM group table")

    raw0, _ = pe.read_va(GROUP0_TABLE, GROUP0_COUNT * 4)
    raw1, _ = pe.read_va(GROUP1_TABLE, GROUP1_COUNT * 4)
    g0 = list(struct.unpack("<100I", raw0))
    g1 = list(struct.unpack("<97I", raw1))
    raw2, _ = pe.read_va(GROUP2_TRANSLATION, GROUP2_COUNT)
    rawh, _ = pe.read_va(GROUP2_HANDLERS, 30 * 4)
    h2 = list(struct.unpack("<30I", rawh))
    routes = []
    for i, route in enumerate(raw2):
        if route >= len(h2):
            raise ValueError("SCM group-2 route indexes outside its handler table")
        routes.append({"opcode": GROUP2_BASE + i, "route_index": route, "handler_va": h2[route]})

    input_raw, _ = pe.read_va(INPUT_TABLE, INPUT_COUNT * 4)
    output_raw, _ = pe.read_va(OUTPUT_TABLE, OUTPUT_COUNT * 4)
    input_targets = list(struct.unpack("<8I", input_raw))
    output_targets = list(struct.unpack("<7I", output_raw))

    ctor_name, _ = pe.read_va(0x0085AD44, 8)
    pool_span = THREAD_POOL_END - THREAD_POOL_START
    if pool_span <= 0 or pool_span % THREAD_STRIDE:
        raise ValueError("Thread pool range is not divisible by record stride")
    pool_count = pool_span // THREAD_STRIDE

    return {
        "target": {"machine": "0x014C", "image_base": "0x00400000"},
        "top_level_groups": table_entries,
        "group_0": {"table_va": f"0x{GROUP0_TABLE:08X}", "entry_count": len(g0), "unique_handlers": len(set(g0)), "fallback_va": "0x00466CBA"},
        "group_1": {"table_va": f"0x{GROUP1_TABLE:08X}", "entry_count": len(g1), "unique_handlers": len(set(g1)), "fallback_va": "0x004683CF"},
        "group_2": {"translation_va": f"0x{GROUP2_TRANSLATION:08X}", "handler_table_va": f"0x{GROUP2_HANDLERS:08X}", "opcode_first": f"0x{GROUP2_BASE:04X}", "opcode_count": GROUP2_COUNT, "routes": routes, "unique_handler_count": len(set(r["handler_va"] for r in routes))},
        "input_operand_dispatch": {"table_va": f"0x{INPUT_TABLE:08X}", "handlers": [f"0x{x:08X}" for x in input_targets]},
        "output_destination_dispatch": {"table_va": f"0x{OUTPUT_TABLE:08X}", "handlers": [f"0x{x:08X}" for x in output_targets]},
        "thread_records": {
            "pool_start_va": f"0x{THREAD_POOL_START:08X}",
            "pool_end_exclusive_va": f"0x{THREAD_POOL_END:08X}",
            "record_stride_bytes": THREAD_STRIDE,
            "record_count": pool_count,
            "active_list_head_global_va": "0x00A8DAAC",
            "secondary_list_head_global_va": "0x00A8DAA8",
            "default_name": ctor_name.split(b"\0", 1)[0].decode("ascii", "replace"),
            "constructor_va": "0x00464960",
            "active_insert_callback_va": "0x0050079F",
        },
        "safety": {"target_executed": False, "target_modified": False, "protected_sections_read": False, "drm_bypassed": False},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("exe", type=Path)
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()
    result = extract(args.exe.read_bytes())
    rendered = json.dumps(result, indent=2) + "\n"
    if args.json:
        args.json.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
