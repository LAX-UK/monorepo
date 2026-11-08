/** The short reference the desk and the buyer quote for a booking: COL-4821. */
const PREFIX = "COL-";
const REFERENCE = /^COL-(\d{4,9})$/;

/** "COL-0042" for sequence 42; sequences past 9999 simply grow ("COL-12345"). */
export function formatCollectionReference(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new RangeError(`Collection sequence must be a positive integer: ${sequence}`);
  }
  return `${PREFIX}${String(sequence).padStart(4, "0")}`;
}

/** The sequence in a reference typed at the desk (any case, surrounding spaces), or `null`. */
export function parseCollectionReference(value: string): number | null {
  const match = REFERENCE.exec(value.trim().toUpperCase());
  if (!match?.[1]) return null;
  const sequence = Number(match[1]);
  return sequence >= 1 ? sequence : null;
}
