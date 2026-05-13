-- Enforce closed status sets (B2). Fails fast if legacy rows exist outside the allow-list.
-- Idempotent: safe to re-run if a prior attempt added some constraints before failing.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM payout
    WHERE status NOT IN ('scheduled', 'in_transit', 'paid', 'failed', 'reversed', 'clawback_pending')
  ) THEN
    RAISE EXCEPTION 'migration_blocked: payout.status has values outside the allow-list';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    INNER JOIN pg_class rel ON rel.oid = c.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE c.conname = 'payout_status_check'
      AND rel.relname = 'payout'
      AND nsp.nspname = current_schema()
  ) THEN
    ALTER TABLE payout
      ADD CONSTRAINT payout_status_check CHECK (
        status IN ('scheduled', 'in_transit', 'paid', 'failed', 'reversed', 'clawback_pending')
      );
  END IF;
END $$;

-- Remap legacy auction_* type names that existed before the lots rename (commit 81a2d2b5).
-- Safe to run repeatedly: UPDATE is a no-op when no matching rows exist.
UPDATE notification SET type = 'lot_won'          WHERE type = 'auction_won';
UPDATE notification SET type = 'lot_lost'         WHERE type = 'auction_lost';
UPDATE notification SET type = 'lot_ending_soon'  WHERE type = 'auction_ending_soon';

-- Remove any remaining rows whose type cannot be mapped to a current value.
-- These are test/seed artefacts; the allow-list below is the source of truth.
DELETE FROM notification
WHERE type NOT IN (
  'outbid',
  'lot_cancelled',
  'lot_won',
  'lot_lost',
  'lot_ending_soon',
  'watchlist_starting',
  'watchlist_ending_soon',
  'payment_received',
  'payment_due',
  'lot_ended_seller'
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM notification
    WHERE type NOT IN (
      'outbid',
      'lot_cancelled',
      'lot_won',
      'lot_lost',
      'lot_ending_soon',
      'watchlist_starting',
      'watchlist_ending_soon',
      'payment_received',
      'payment_due',
      'lot_ended_seller'
    )
  ) THEN
    RAISE EXCEPTION 'migration_blocked: notification.type has values outside the allow-list';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    INNER JOIN pg_class rel ON rel.oid = c.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE c.conname = 'notification_type_check'
      AND rel.relname = 'notification'
      AND nsp.nspname = current_schema()
  ) THEN
    ALTER TABLE notification
      ADD CONSTRAINT notification_type_check CHECK (
        type IN (
          'outbid',
          'lot_cancelled',
          'lot_won',
          'lot_lost',
          'lot_ending_soon',
          'watchlist_starting',
          'watchlist_ending_soon',
          'payment_received',
          'payment_due',
          'lot_ended_seller'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM legal_entity_payout_method
    WHERE status NOT IN ('active', 'retired')
  ) THEN
    RAISE EXCEPTION 'migration_blocked: legal_entity_payout_method.status has values outside the allow-list';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    INNER JOIN pg_class rel ON rel.oid = c.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE c.conname = 'legal_entity_payout_method_status_check'
      AND rel.relname = 'legal_entity_payout_method'
      AND nsp.nspname = current_schema()
  ) THEN
    ALTER TABLE legal_entity_payout_method
      ADD CONSTRAINT legal_entity_payout_method_status_check CHECK (status IN ('active', 'retired'));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM email_outbox
    WHERE status NOT IN ('pending', 'sending', 'sent', 'failed', 'suppressed')
  ) THEN
    RAISE EXCEPTION 'migration_blocked: email_outbox.status has values outside the allow-list';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    INNER JOIN pg_class rel ON rel.oid = c.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE c.conname = 'email_outbox_status_check'
      AND rel.relname = 'email_outbox'
      AND nsp.nspname = current_schema()
  ) THEN
    ALTER TABLE email_outbox
      ADD CONSTRAINT email_outbox_status_check CHECK (
        status IN ('pending', 'sending', 'sent', 'failed', 'suppressed')
      );
  END IF;
END $$;
