/**
 * Bounded, evidence-backed byte-level helpers for the GTA San Andreas SCM VM.
 * This is not a complete mission interpreter. Unmapped/protected operand types
 * are rejected explicitly rather than guessed.
 */
export const SCM_OPCODE_CONDITION_BIT = 0x8000;
export const SCM_OPCODE_VALUE_MASK = 0x7fff;
export const SCM_OPCODE_GROUP_SIZE = 100;
export const SCM_MAX_INPUT_OPERANDS = 64;

export class ScmDecodeError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ScmDecodeError";
    this.details = details;
  }
}

export class ScmUnsupportedOperandError extends ScmDecodeError {
  constructor(typeTag, offset) {
    super(`SCM operand type ${typeTag} at byte ${offset} is not implemented`, { typeTag, offset });
    this.name = "ScmUnsupportedOperandError";
  }
}

function requireRange(bytes, offset, size, label) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("SCM bytecode must be Uint8Array");
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size)
    || offset < 0 || size < 0 || offset + size > bytes.byteLength) {
    throw new ScmDecodeError(`Truncated SCM ${label}`, { offset, size, byteLength: bytes.byteLength });
  }
}

function viewFor(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function fetchScmOpcode(bytes, instructionPointer) {
  requireRange(bytes, instructionPointer, 2, "opcode");
  const rawOpcode = viewFor(bytes).getUint16(instructionPointer, true);
  const opcode = rawOpcode & SCM_OPCODE_VALUE_MASK;
  return {
    rawOpcode,
    opcode,
    conditionBit: (rawOpcode & SCM_OPCODE_CONDITION_BIT) !== 0,
    group: Math.floor(opcode / SCM_OPCODE_GROUP_SIZE),
    nextInstructionPointer: instructionPointer + 2,
  };
}

function requireGlobalRange(globals, offset, size = 4) {
  if (!(globals instanceof Uint8Array)) throw new TypeError("SCM global space must be Uint8Array");
  if (!Number.isSafeInteger(offset) || offset < 0 || size < 0 || offset + size > globals.byteLength) {
    throw new ScmDecodeError("SCM global-variable offset is outside the supplied global space", {
      offset, size, globalBytes: globals.byteLength,
    });
  }
}

/**
 * Supported input tags: 1/6 raw dword, 2 global dword reference,
 * 4 signed byte, 5 signed word. Tags 3,7,8 remain unsupported.
 * The caller's cursor is unchanged if decoding throws.
 */
export function decodeScmInputOperands(bytes, instructionPointer, operandCount, globals) {
  if (!Number.isSafeInteger(operandCount) || operandCount < 0 || operandCount > SCM_MAX_INPUT_OPERANDS) {
    throw new ScmDecodeError("SCM operand count exceeds the supported safety limit", { operandCount });
  }
  requireRange(bytes, instructionPointer, 0, "operand stream");
  const view = viewFor(bytes);
  let cursor = instructionPointer;
  const values = [];
  const descriptors = [];

  for (let index = 0; index < operandCount; index += 1) {
    requireRange(bytes, cursor, 1, `operand ${index} type tag`);
    const typeTag = view.getUint8(cursor);
    const tagOffset = cursor;
    cursor += 1;

    switch (typeTag) {
      case 1:
      case 6: {
        requireRange(bytes, cursor, 4, `operand ${index} dword`);
        const value = view.getUint32(cursor, true);
        values.push(value);
        descriptors.push({ typeTag, offset: tagOffset, rawValue: value, kind: "immediate-dword" });
        cursor += 4;
        break;
      }
      case 2: {
        requireRange(bytes, cursor, 2, `operand ${index} global offset`);
        const globalOffset = view.getUint16(cursor, true);
        cursor += 2;
        requireGlobalRange(globals, globalOffset, 4);
        const value = viewFor(globals).getUint32(globalOffset, true);
        values.push(value);
        descriptors.push({ typeTag, offset: tagOffset, globalOffset, rawValue: value, kind: "global-dword" });
        break;
      }
      case 4: {
        requireRange(bytes, cursor, 1, `operand ${index} signed byte`);
        const value = view.getInt8(cursor);
        values.push(value);
        descriptors.push({ typeTag, offset: tagOffset, value, kind: "signed-byte" });
        cursor += 1;
        break;
      }
      case 5: {
        requireRange(bytes, cursor, 2, `operand ${index} signed word`);
        const value = view.getInt16(cursor, true);
        values.push(value);
        descriptors.push({ typeTag, offset: tagOffset, value, kind: "signed-word" });
        cursor += 2;
        break;
      }
      case 3:
      case 7:
      case 8:
        throw new ScmUnsupportedOperandError(typeTag, tagOffset);
      default:
        throw new ScmDecodeError(`Unknown SCM input operand type ${typeTag}`, {
          typeTag, offset: tagOffset, operandIndex: index,
        });
    }
  }

  return { values, descriptors, nextInstructionPointer: cursor };
}

/** Writes a single result through the confirmed output type-2 global descriptor. */
export function writeScmGlobalResult(bytes, instructionPointer, globals, value) {
  requireRange(bytes, instructionPointer, 1, "output destination type");
  const view = viewFor(bytes);
  const typeTag = view.getUint8(instructionPointer);
  if (typeTag !== 2) throw new ScmUnsupportedOperandError(typeTag, instructionPointer);
  requireRange(bytes, instructionPointer + 1, 2, "global output offset");
  const globalOffset = view.getUint16(instructionPointer + 1, true);
  requireGlobalRange(globals, globalOffset, 4);
  viewFor(globals).setUint32(globalOffset, Number(value) >>> 0, true);
  return { nextInstructionPointer: instructionPointer + 3, globalOffset };
}
