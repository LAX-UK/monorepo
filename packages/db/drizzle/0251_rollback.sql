-- Rollback for 0251_payment_open_per_account.
DROP INDEX IF EXISTS "payment_lot_buyer_open_account_unique";
