import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeScmInputOperands, fetchScmOpcode, ScmDecodeError,
  ScmUnsupportedOperandError, writeScmGlobalResult,
} from "../src/web/scm-vm-core.js";

const bytes = (...values) => new Uint8Array(values);

test("fetches opcode and selects its decimal group", () => {
  assert.deepEqual(fetchScmOpcode(bytes(0xD6,0),0), {
    rawOpcode:0xD6, opcode:0xD6, conditionBit:false, group:2, nextInstructionPointer:2,
  });
});
test("preserves the high condition bit", () => {
  const op=fetchScmOpcode(bytes(0xD6,0x80),0);
  assert.equal(op.opcode,0xD6); assert.equal(op.conditionBit,true); assert.equal(op.group,2);
});
test("decodes immediate/global/signed input kinds", () => {
  const globals=new Uint8Array(16);
  new DataView(globals.buffer).setUint32(4,0x12345678,true);
  const stream=bytes(1,0xEF,0xCD,0xAB,0x89, 2,4,0, 4,0xFE, 5,0,0x80, 6,1,2,3,4);
  const result=decodeScmInputOperands(stream,0,5,globals);
  assert.deepEqual(result.values,[0x89ABCDEF,0x12345678,-2,-32768,0x04030201]);
  assert.equal(result.nextInstructionPointer,stream.byteLength);
});
test("writes output type-2 global destination", () => {
  const globals=new Uint8Array(12);
  const result=writeScmGlobalResult(bytes(2,8,0),0,globals,0xDEADBEEF);
  assert.deepEqual(result,{nextInstructionPointer:3,globalOffset:8});
  assert.equal(new DataView(globals.buffer).getUint32(8,true),0xDEADBEEF);
});
test("rejects protected/indexed tags rather than guessing", () => {
  for (const tag of [3,7,8]) {
    assert.throws(()=>decodeScmInputOperands(bytes(tag),0,1,new Uint8Array(16)),
      e=>e instanceof ScmUnsupportedOperandError && e.details.typeTag===tag);
  }
  assert.throws(()=>writeScmGlobalResult(bytes(7),0,new Uint8Array(16),1),ScmUnsupportedOperandError);
});
test("rejects truncation, bad offsets and unknown tags", () => {
  assert.throws(()=>fetchScmOpcode(bytes(0xD6),0),ScmDecodeError);
  assert.throws(()=>decodeScmInputOperands(bytes(1,1,2),0,1,new Uint8Array(8)),ScmDecodeError);
  assert.throws(()=>decodeScmInputOperands(bytes(2,0xFE,0xFF),0,1,new Uint8Array(8)),ScmDecodeError);
  assert.throws(()=>decodeScmInputOperands(bytes(99),0,1,new Uint8Array(8)),ScmDecodeError);
});
