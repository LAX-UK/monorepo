import type pg from "pg";
import type {
  ArchivedReleaseRow,
  LedgerRow,
  ReleaseRowToArchive,
} from "./release-lineage-normalisation.js";
import type {
  NormalisationMode,
  ReleaseLineageLedger,
  ReleaseLineageUnitOfWork,
} from "./release-lineage-normaliser.js";

/** Postgres adapter for the migration ledger and the release lineage archive. */

export const MIGRATION_LEDGER_TABLE = `"drizzle"."__drizzle_migrations"`;
export const RELEASE_LINEAGE_ARCHIVE_TABLE = `"drizzle"."__release_lineage_archive"`;

const APPLY_LOCK_TIMEOUT = "10s";

/**
 * Archived release rows; none when the archive was never created (every non-production
 * database). Probes with `to_regclass` rather than catching "undefined table", which would
 * abort the caller's transaction.
 */
export async function readArchivedReleaseRows(
  client: pg.ClientBase,
): Promise<ArchivedReleaseRow[]> {
  const probe = await client.query<{ present: boolean }>(
    "select to_regclass($1) is not null as present",
    [RELEASE_LINEAGE_ARCHIVE_TABLE],
  );
  if (!probe.rows[0]?.present) return [];
  const result = await client.query<{ hash: string; created_at: string; release_tag: string }>(
    `select hash, created_at, release_tag from ${RELEASE_LINEAGE_ARCHIVE_TABLE} order by created_at`,
  );
  return result.rows.map((row) => ({
    hash: row.hash,
    createdAt: Number(row.created_at),
    releaseTag: row.release_tag,
  }));
}

class PgReleaseLineageLedger implements ReleaseLineageLedger {
  constructor(private readonly client: pg.ClientBase) {}

  async readLedger(): Promise<LedgerRow[]> {
    const result = await this.client.query<{
      id: number;
      hash: string;
      created_at: string | null;
    }>(`select id, hash, created_at from ${MIGRATION_LEDGER_TABLE} order by created_at, id`);
    return result.rows.map((row) => {
      if (row.created_at == null) {
        throw new Error(`Ledger row ${row.id} has no created_at; review it by hand`);
      }
      return { id: row.id, hash: row.hash, createdAt: Number(row.created_at) };
    });
  }

  readArchive(): Promise<ArchivedReleaseRow[]> {
    return readArchivedReleaseRows(this.client);
  }

  async archive(rows: readonly ReleaseRowToArchive[], releaseHead: string): Promise<void> {
    await this.client.query(
      `create table if not exists ${RELEASE_LINEAGE_ARCHIVE_TABLE} (
        created_at bigint primary key,
        hash text not null,
        release_tag text not null,
        disposition text not null check (disposition in ('adopt', 'archive-only')),
        main_tag text,
        release_head text not null,
        ledger_id integer not null,
        archived_at timestamptz not null default now()
      )`,
    );
    for (const { ledgerId, row } of rows) {
      await this.client.query(
        `insert into ${RELEASE_LINEAGE_ARCHIVE_TABLE}
           (created_at, hash, release_tag, disposition, main_tag, release_head, ledger_id)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          row.releaseWhen,
          row.sha256,
          row.releaseTag,
          row.disposition.kind,
          row.disposition.kind === "adopt" ? row.disposition.mainTag : null,
          releaseHead,
          ledgerId,
        ],
      );
    }
    const ids = rows.map((entry) => entry.ledgerId);
    const deleted = await this.client.query(
      `delete from ${MIGRATION_LEDGER_TABLE} where id = any($1::int[])`,
      [ids],
    );
    if (deleted.rowCount !== ids.length) {
      throw new Error(
        `Expected to move ${ids.length} ledger rows but removed ${deleted.rowCount ?? 0}; rolled back`,
      );
    }
  }
}

/** One transaction per run on a dedicated client: read-only for a dry run, locked for an apply. */
export class PgReleaseLineageUnitOfWork implements ReleaseLineageUnitOfWork {
  constructor(private readonly client: pg.ClientBase) {}

  async run<T>(
    mode: NormalisationMode,
    work: (ledger: ReleaseLineageLedger) => Promise<T>,
  ): Promise<T> {
    await this.client.query(mode === "apply" ? "begin" : "begin transaction read only");
    try {
      if (mode === "apply") {
        await this.client.query(`set local lock_timeout = '${APPLY_LOCK_TIMEOUT}'`);
        // Blocks a concurrent migrate run from reading or writing the ledger mid-normalisation.
        await this.client.query(`lock table ${MIGRATION_LEDGER_TABLE} in access exclusive mode`);
      }
      const result = await work(new PgReleaseLineageLedger(this.client));
      await this.client.query(mode === "apply" ? "commit" : "rollback");
      return result;
    } catch (error) {
      await this.client.query("rollback").catch(() => {});
      throw error;
    }
  }
}
