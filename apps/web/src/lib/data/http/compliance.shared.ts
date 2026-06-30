/** Shared JSON parsing helpers for compliance HTTP modules. */
export function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Align with nav badge fetch cap so queue rows match sidebar counts. */
export const COMPLIANCE_QUEUE_LIST_LIMIT = 200;
