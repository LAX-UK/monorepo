# Review of #1375 — in progress

Branch `bk9-bid-refunds` at `e97c9de5`. Main at `3c911293`.

- [x] PR body and earlier reviews (#1359, #1366, incl. recheck sections) read
- [x] Migration clash confirmed: main has `0384_unapplied_money_dedupe_key_uid` (#1372) at idx 376, stamp `1811332800000`; this PR's `0384_accounting_credit_note_refunds` claims the same idx and stamp. `git merge origin/main` conflicts (add/add on `0384_rollback.sql`, and the journal).
- [x] Local merge + renumber to 0385 (not pushed); `db:migrate` (377) and `db:roles` on throwaway PG 16.15
- [x] PR's new integration suites green (11 + 6)
- [ ] Batches, review tests, mutations, shots
