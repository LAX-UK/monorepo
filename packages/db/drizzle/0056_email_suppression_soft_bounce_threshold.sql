ALTER TABLE email_suppression DROP CONSTRAINT IF EXISTS email_suppression_reason_check;
ALTER TABLE email_suppression
  ADD CONSTRAINT email_suppression_reason_check CHECK (
    reason IN ('hard_bounce', 'complaint', 'manual', 'unsubscribe', 'soft_bounce_threshold')
  );
