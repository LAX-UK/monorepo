const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SHORT_CODE_LENGTH = 8;
const COUNTER_MASK = 0x5deece66dn;

export function encodeQrSequence(sequence: bigint): string {
  const shuffled = sequence ^ COUNTER_MASK;
  let value = shuffled;
  let out = "";
  do {
    out = BASE62[Number(value % 62n)] + out;
    value /= 62n;
  } while (value > 0n);
  return out.padStart(SHORT_CODE_LENGTH, BASE62[0]);
}

export function decodeQrSequence(code: string): bigint {
  let value = 0n;
  for (const char of code) {
    const idx = BASE62.indexOf(char);
    if (idx < 0) throw new Error("Invalid Base62 character");
    value = value * 62n + BigInt(idx);
  }
  return value ^ COUNTER_MASK;
}
