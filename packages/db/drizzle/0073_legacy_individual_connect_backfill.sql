-- Backfill legacy sole-trader individuals approved before Connect lifecycle gates.
-- Demote to connect_pending when Connect account is missing or not payout-ready.
UPDATE legal_entity
SET
  status = 'connect_pending',
  status_changed_at = NOW(),
  updated_at = NOW()
WHERE kind = 'individual'
  AND status = 'approved'
  AND (
    stripe_connect_account_id IS NULL
    OR stripe_connect_payouts_enabled = false
    OR jsonb_array_length(stripe_connect_requirements_currently_due) > 0
  );
