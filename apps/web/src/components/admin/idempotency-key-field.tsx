"use client";

import { IDEMPOTENCY_KEY_FIELD } from "@/lib/admin/finance/idempotency-key";
import { useIdempotencyKey } from "@/lib/admin/finance/use-idempotency-key";

/** Hidden field that gives one form instance its own idempotency key for the money action. */
export function IdempotencyKeyField() {
  const { key } = useIdempotencyKey();
  return <input type="hidden" name={IDEMPOTENCY_KEY_FIELD} value={key} readOnly />;
}
