-- Rollback for 0267_watchlist_reminders. Roll back the application release first: the previous
-- release neither reads nor sends watched-lot reminders. Saved reminders and notes are lost;
-- watched lots themselves are kept.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "watchlist_reminder";
