CREATE TYPE "condition_report_request_status" AS ENUM ('pending', 'in_progress', 'fulfilled', 'declined');

CREATE TABLE "condition_report_request" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lot_id" uuid NOT NULL REFERENCES "lot"("id") ON DELETE CASCADE,
  "requested_by_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "requesting_legal_entity_id" uuid REFERENCES "legal_entity"("id") ON DELETE SET NULL,
  "status" "condition_report_request_status" NOT NULL DEFAULT 'pending',
  "request_note" text,
  "response_note" text,
  "response_attachment_upload_id" uuid REFERENCES "upload_object"("id") ON DELETE SET NULL,
  "fulfilled_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "fulfilled_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "condition_report_request_lot_id_idx" ON "condition_report_request" ("lot_id");
CREATE INDEX "condition_report_request_status_created_idx" ON "condition_report_request" ("status", "created_at");
