-- An organisation's purchase can be paid by any of its payers (owners, admins, finance), so a lot
-- carries at most one open payment per buyer account, whichever member started it.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
-- Existing data first, so the index can always be built.
--
-- Rows where money has moved (captured, authorized) are never touched. Two of them for one lot and
-- account cannot exist: until this release only the winner could pay, and the
-- payment_lot_buyer_open_unique index already allowed one open payment per lot and person.
--
-- What can exist is a stale open row next to another one (for example an invoice raised for the
-- winner and a second pending payment after the lot was re-awarded within the same account).
-- Those are resolved deterministically: per lot and account the row kept is the one furthest
-- along (captured, then authorized, then manual review, then pending), newest first; every other
-- pending or manual-review row is cancelled, the same status the stale-payment expiry job uses.
WITH ranked AS (
  SELECT
    id,
    status,
    row_number() OVER (
      PARTITION BY lot_id, buyer_legal_entity_id
      ORDER BY
        CASE status
          WHEN 'captured' THEN 0
          WHEN 'authorized' THEN 1
          WHEN 'requires_manual_review' THEN 2
          ELSE 3
        END,
        created_at DESC,
        id DESC
    ) AS position
  FROM "payment"
  WHERE status IN ('pending', 'authorized', 'captured', 'requires_manual_review')
)
UPDATE "payment" AS p
SET status = 'cancelled'
FROM ranked
WHERE p.id = ranked.id
  AND ranked.position > 1
  AND ranked.status IN ('pending', 'requires_manual_review');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_lot_buyer_open_account_unique"
  ON "payment" ("lot_id", "buyer_legal_entity_id")
  WHERE "status" IN ('pending', 'authorized', 'captured', 'requires_manual_review');
