-- The client workspace's selling modules. Each consignment gets a reference number to quote to a
-- specialist, and each lot that ended unsold keeps the date its seller must choose by, so a date
-- a seller has been told never moves if the unsold-choice window changes later.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "item_submission_reference_seq" START WITH 1001;
--> statement-breakpoint
ALTER TABLE "item_submission" ADD COLUMN IF NOT EXISTS "reference_number" bigint;
--> statement-breakpoint
-- Existing consignments are numbered in the order they were created, from 1001.
WITH ordered AS (
  SELECT id, 1000 + row_number() OVER (ORDER BY created_at, id) AS n
  FROM "item_submission"
  WHERE reference_number IS NULL
)
UPDATE "item_submission" AS s
SET reference_number = ordered.n
FROM ordered
WHERE s.id = ordered.id;
--> statement-breakpoint
SELECT setval(
  'item_submission_reference_seq',
  GREATEST((SELECT COALESCE(max(reference_number), 1000) FROM "item_submission"), 1000)
);
--> statement-breakpoint
ALTER TABLE "item_submission"
  ALTER COLUMN "reference_number" SET DEFAULT nextval('item_submission_reference_seq');
--> statement-breakpoint
ALTER TABLE "item_submission" ALTER COLUMN "reference_number" SET NOT NULL;
--> statement-breakpoint
ALTER SEQUENCE "item_submission_reference_seq" OWNED BY "item_submission"."reference_number";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "item_submission_reference_number_uidx"
  ON "item_submission" ("reference_number");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unsold_choice_deadline" (
  "lot_id" uuid NOT NULL,
  "lot_end_time" timestamp with time zone NOT NULL,
  "choose_by" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "unsold_choice_deadline_pk" PRIMARY KEY ("lot_id", "lot_end_time"),
  CONSTRAINT "unsold_choice_deadline_lot_id_lot_id_fk"
    FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE cascade
);
--> statement-breakpoint
-- Lots that already ended unsold keep the window in force today: 14 days from the end of the sale.
INSERT INTO "unsold_choice_deadline" ("lot_id", "lot_end_time", "choose_by")
SELECT l.id, l.end_time, l.end_time + interval '14 days'
FROM "lot" AS l
JOIN "item_submission" AS s ON s.converted_lot_id = l.id
WHERE l.status IN ('ended', 'voided') AND l.winner_id IS NULL
ON CONFLICT DO NOTHING;
