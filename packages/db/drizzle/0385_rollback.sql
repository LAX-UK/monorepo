-- Rollback for 0385_accounting_credit_note_refunds. Roll the release back first, then this.
-- Restores 0383's history actions. The CHECK is added back NOT VALID, so `refund_credit_note` rows
-- already written stay (history is append-only) while the earlier release can write no new one.
-- Credit notes are not touched. Also removes this migration's ledger row so a later deploy
-- reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
ALTER TABLE "accounting_document_event" DROP CONSTRAINT IF EXISTS "accounting_document_event_action_ck";
ALTER TABLE "accounting_document_event" ADD CONSTRAINT "accounting_document_event_action_ck" CHECK (
  "action" IN ('created', 'start_sending', 'expire_lease', 'complete_sending', 'apply_lookup',
    'escalate', 'requeue', 'cancel', 'release', 'park', 'apply_remainder')
) NOT VALID;

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811419200000;

COMMIT;
