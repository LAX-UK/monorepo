export const IDEMPOTENCY_KEY_FIELD = "idempotencyKey";
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/**
 * The key the form carried, so a double submit of the same form repeats one request; a new
 * key is made when the form carried none (older markup, direct calls).
 */
export function idempotencyKeyFrom(formData: FormData): string {
  const raw = formData.get(IDEMPOTENCY_KEY_FIELD);
  const supplied = typeof raw === "string" ? raw.trim() : "";
  return supplied.length >= 8 && supplied.length <= 128 ? supplied : crypto.randomUUID();
}
