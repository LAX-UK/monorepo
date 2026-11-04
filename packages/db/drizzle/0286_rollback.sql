-- Drops the follow-up work for confirmed unsold-lot choices. Roll back the application release
-- first: the previous release neither creates nor reads it. A reserve already put on a lot stays.
DROP TABLE IF EXISTS "unsold_lot_follow_up";
