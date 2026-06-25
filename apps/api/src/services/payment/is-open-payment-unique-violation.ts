/** Detect Postgres unique violation on the open-payment partial index. */
export function isOpenPaymentUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const pg = err as { code?: unknown; message?: unknown };
  if (pg.code !== "23505") return false;
  const message = typeof pg.message === "string" ? pg.message : "";
  return (
    message.includes("payment_lot_buyer_open_unique") || message.includes("payment_lot_buyer_open")
  );
}
