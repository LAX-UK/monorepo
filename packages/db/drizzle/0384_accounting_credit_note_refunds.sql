-- Bid refunds as credit notes (Zoho Books plan v2, flows 8-11). Applies after 0383.
--
-- A credit note for a refund that went through is refunded in the books from the Stripe clearing
-- account once it is issued, and the worker records that once on the credit note's history as
-- `refund_credit_note` (issued to issued), as 0383 did for `apply_remainder`. The action list gains
-- it; nothing else about history changes. No table, column or grant is added: the worker already
-- appends history and reads `document_id, action, to_state, occurred_at` of it (db:roles).
--
-- Another open change (payment hardening, #1372) may also claim 0384: whichever merges second
-- renumbers its migration and journal entry.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "accounting_document_event" DROP CONSTRAINT IF EXISTS "accounting_document_event_action_ck";
--> statement-breakpoint
ALTER TABLE "accounting_document_event" ADD CONSTRAINT "accounting_document_event_action_ck" CHECK (
  "action" IN ('created', 'start_sending', 'expire_lease', 'complete_sending', 'apply_lookup',
    'escalate', 'requeue', 'cancel', 'release', 'park', 'apply_remainder', 'refund_credit_note')
);
