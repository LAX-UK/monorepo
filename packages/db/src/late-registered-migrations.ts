/**
 * Migrations that main registers behind environments that already moved past
 * their journal `when`.
 *
 * `0131a_atg_sync_links` is release migration `0132_atg_sync_links`, applied in
 * production at `1788000007500`. Main registers the byte-identical SQL at the same
 * stamp so production's ledger row matches by hash. Main's own environments
 * (test, developer databases) were migrated before it existed, so their ledgers
 * hold later rows and the runner would otherwise stop with "missing ... before
 * applied timestamp".
 *
 * Only additive, idempotent SQL (`IF NOT EXISTS`) may be listed here: the runner
 * applies it in place and records its ledger row instead of failing. A row that
 * exists with a different hash is still a divergence and still fails closed.
 */
export const LATE_REGISTERED_FOLDER_MILLIS: ReadonlySet<number> = new Set([1788000007500]);
