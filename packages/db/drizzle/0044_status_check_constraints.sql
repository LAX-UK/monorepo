-- Enforce closed status sets (B2). Fails fast if legacy rows exist outside the allow-list.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM payout
    WHERE status NOT IN ('scheduled', 'in_transit', 'paid', 'failed', 'reversed', 'clawback_pending')
  ) THEN
    RAISE EXCEPTION 'migration_blocked: payout.status has values outside the allow-list';
  END IF;
END $$;

ALTER TABLE payout
  ADD CONSTRAINT payout_status_check CHECK (
    status IN ('scheduled', 'in_transit', 'paid', 'failed', 'reversed', 'clawback_pending')
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM legal_entity_payout_method
    WHERE status NOT IN ('active', 'retired')
  ) THEN
    RAISE EXCEPTION 'migration_blocked: legal_entity_payout_method.status has values outside the allow-list';
  END IF;
END $$;

ALTER TABLE legal_entity_payout_method
  ADD CONSTRAINT legal_entity_payout_method_status_check CHECK (status IN ('active', 'retired'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM email_outbox
    WHERE status NOT IN ('pending', 'sending', 'sent', 'failed', 'suppressed')
  ) THEN
    RAISE EXCEPTION 'migration_blocked: email_outbox.status has values outside the allow-list';
  END IF;
END $$;

ALTER TABLE email_outbox
  ADD CONSTRAINT email_outbox_status_check CHECK (
    status IN ('pending', 'sending', 'sent', 'failed', 'suppressed')
  );
