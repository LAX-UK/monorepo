CREATE TABLE "sale_document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sale_id" uuid NOT NULL REFERENCES "sale"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "label" text,
  "upload_object_id" uuid NOT NULL REFERENCES "upload_object"("id") ON DELETE RESTRICT,
  "created_by_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "sale_document_sale_id_idx" ON "sale_document" ("sale_id");

CREATE TABLE "submission_document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL REFERENCES "item_submission"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "label" text,
  "upload_object_id" uuid NOT NULL REFERENCES "upload_object"("id") ON DELETE RESTRICT,
  "created_by_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "submission_document_submission_id_idx" ON "submission_document" ("submission_id");
