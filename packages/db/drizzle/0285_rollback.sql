-- Rollback for 0285_shop_returns_stock. Roll back the application release first: the previous
-- release neither writes nor reads these columns. The recorded dispositions and outside
-- settlements are lost; the refunds and returns themselves stay.
SET LOCAL lock_timeout = '30s';

ALTER TABLE shop_refund DROP CONSTRAINT IF EXISTS shop_refund_settled_outside_ck;
ALTER TABLE shop_refund DROP COLUMN IF EXISTS settled_outside_by_subject_id;
ALTER TABLE shop_refund DROP COLUMN IF EXISTS settled_outside_reason;
ALTER TABLE shop_refund DROP COLUMN IF EXISTS settled_outside_reference;
ALTER TABLE shop_refund DROP COLUMN IF EXISTS settled_outside_at;

ALTER TABLE shop_return DROP CONSTRAINT IF EXISTS shop_return_disposition_ck;
ALTER TABLE shop_return DROP COLUMN IF EXISTS disposition;
