type PgError = { code?: unknown; message?: unknown; constraint?: unknown; cause?: unknown };

const OPEN_PAYMENT_INDEXES = [
  "payment_lot_buyer_open_unique",
  "payment_lot_buyer_open_account_unique",
];

function isOpenPaymentViolation(err: PgError): boolean {
  if (err.code !== "23505") return false;
  const constraint = typeof err.constraint === "string" ? err.constraint : "";
  const message = typeof err.message === "string" ? err.message : "";
  return OPEN_PAYMENT_INDEXES.some((name) => constraint === name || message.includes(name));
}

/**
 * Detects the Postgres unique violation on the open-payment partial indexes: another request
 * created the invoice first. The driver error may arrive as is or wrapped as the query error's
 * `cause`.
 */
export function isOpenPaymentUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const outer = err as PgError;
  if (isOpenPaymentViolation(outer)) return true;
  const cause = outer.cause;
  return typeof cause === "object" && cause !== null && isOpenPaymentViolation(cause as PgError);
}
