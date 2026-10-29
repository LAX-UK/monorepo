-- Rolls back 0135: nothing to do. 0135 only moved the refund notice projector's cursor forward.
-- Moving it back would announce refunds that were deliberately skipped, so the cursor stays.
SELECT 1;
