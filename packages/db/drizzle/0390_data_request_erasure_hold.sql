-- Data requests whose enquiry erasure was held by a private sale deal (PS-5F1, PS-5F2).
-- Numbered 0390 (0389 is held for another open PR); a later merger renumbers.
--
-- `data_request_erasure_hold`: one row per request reference. `waiting` rows are re-run by the
-- API's schedule once `recheck_at` passes; `needs_staff` rows (a hold with no end date, or a re-run
-- that still could not complete) are listed in the Data requests queue. A re-run claims a row with
-- `claimed_until` under FOR UPDATE SKIP LOCKED, so concurrent runs never take the same request.
-- The row goes when the erasure completes. No personal data: reference, staff id, dates, reason.
--
-- Grants (db:roles): api_app by default; no other role reads it.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_request_erasure_hold" (
  "reference" text PRIMARY KEY NOT NULL,
  "requested_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "state" text NOT NULL,
  "reason" text NOT NULL,
  "held_until" timestamp with time zone,
  "recheck_at" timestamp with time zone,
  "claimed_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "data_request_erasure_hold_state_ck" CHECK ("state" IN ('waiting', 'needs_staff')),
  CONSTRAINT "data_request_erasure_hold_reason_ck"
    CHECK ("reason" IN ('running', 'open_deal', 'end_unknown', 'still_held', 'cannot_run')),
  CONSTRAINT "data_request_erasure_hold_waiting_ck"
    CHECK ("state" <> 'waiting' OR "recheck_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_request_erasure_hold_due_idx"
  ON "data_request_erasure_hold" ("recheck_at") WHERE "state" = 'waiting';
