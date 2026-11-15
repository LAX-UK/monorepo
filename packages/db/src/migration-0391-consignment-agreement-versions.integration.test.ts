import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrationsPerTransaction } from "./migrate-runner.js";
import { buildPgConnectionConfig } from "./ssl.js";
import { withTemporaryDatabase } from "./testing/temporary-database.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;

type Queryable = Pick<pg.Client, "query">;

async function one(db: Queryable, text: string, values: unknown[] = []): Promise<string> {
  return (await db.query<{ id: string }>(text, values)).rows[0]?.id as string;
}

/** A seller and a consignment with its signed version 1. */
async function seedSigned(
  db: Queryable,
): Promise<{ sellerId: string; submissionId: string; v1: string }> {
  const userId = `u-${randomUUID()}`;
  await db.query(
    `insert into "user" (id, name, email, created_at, updated_at) values ($1, 'Seller', $2, now(), now())`,
    [userId, `${userId}@example.test`],
  );
  const sellerId = await one(
    db,
    `insert into legal_entity (kind, subkind, display_name, created_by_user_id)
     values ('organisation', 'gallery', $1, $2) returning id`,
    [`Gallery ${userId}`, userId],
  );
  const submissionId = await one(
    db,
    `insert into item_submission (legal_entity_id, title) values ($1, 'Work') returning id`,
    [sellerId],
  );
  const v1 = await one(
    db,
    `insert into consignment_agreement
       (submission_id, legal_entity_id, terms_version, commission_percent, accepted_at, accepted_by_user_id)
     values ($1, $2, 'v1', 12, now(), $3) returning id`,
    [submissionId, sellerId, userId],
  );
  return { sellerId, submissionId, v1 };
}

/** Supersedes `previous` by its next version, in the order the application writes them. */
async function supersede(db: Queryable, previous: string, version: number, commission: number) {
  const next = randomUUID();
  await db.query(
    "update consignment_agreement set superseded_at = now(), superseded_by = $2 where id = $1",
    [previous, next],
  );
  await db.query(
    `insert into consignment_agreement
       (id, submission_id, legal_entity_id, terms_version, commission_percent, accepted_at, version)
     select $2, submission_id, legal_entity_id, terms_version, $4, accepted_at, $3
       from consignment_agreement where id = $1`,
    [previous, next, version, commission],
  );
  return next;
}

/** Every probe runs in a savepoint inside one transaction that is rolled back at the end. */
describe.skipIf(!url)(
  "migration 0391 consignment agreement versions (database)",
  { timeout: 60_000 },
  () => {
    let client: pg.Client;

    async function refused(work: () => Promise<unknown>): Promise<string | null> {
      await client.query("savepoint probe");
      try {
        await work();
        // The superseded_by key is checked at commit; check it now, inside the probe.
        await client.query("set constraints all immediate");
        return null;
      } catch (err) {
        return (err as Error).message;
      } finally {
        await client.query("rollback to savepoint probe");
        await client.query("set constraints all deferred");
      }
    }

    beforeAll(async () => {
      if (!url) return;
      client = new pg.Client(buildPgConnectionConfig(url));
      await client.connect();
      await client.query("begin");
    });

    afterAll(async () => {
      if (!client) return;
      await client.query("rollback");
      await client.end();
    });

    it("supersedes a signed version by its next one, which becomes the one current row", async () => {
      const { submissionId, v1 } = await seedSigned(client);
      expect(await refused(() => supersede(client, v1, 2, 15))).toBeNull();
      const v2 = await supersede(client, v1, 2, 15);
      await client.query("set constraints all immediate");
      await client.query("set constraints all deferred");
      const rows = await client.query<{
        id: string;
        version: number;
        superseded_by: string | null;
      }>(
        `select id, version, superseded_by from consignment_agreement
        where submission_id = $1 order by version`,
        [submissionId],
      );
      expect(rows.rows).toEqual([
        { id: v1, version: 1, superseded_by: v2 },
        { id: v2, version: 2, superseded_by: null },
      ]);
    });

    it("refuses a second current version, a repeated number, and superseding what was never signed", async () => {
      const { submissionId, sellerId, v1 } = await seedSigned(client);
      const insert = (version: number) =>
        client.query(
          `insert into consignment_agreement (submission_id, legal_entity_id, terms_version, version)
         values ($1, $2, 'v1', $3)`,
          [submissionId, sellerId, version],
        );
      expect(await refused(() => insert(2))).toMatch(/consignment_agreement_submission_id_uidx/);
      expect(await refused(() => supersede(client, v1, 1, 15))).toMatch(
        /consignment_agreement_submission_version_uidx/,
      );
      await client.query("update consignment_agreement set accepted_at = null where id = $1", [v1]);
      expect(await refused(() => supersede(client, v1, 2, 15))).toMatch(
        /consignment_agreement_superseded_ck/,
      );
      // A successor that never arrives fails at commit.
      expect(
        await refused(() =>
          client.query(
            "update consignment_agreement set accepted_at = now(), superseded_at = now(), superseded_by = $2 where id = $1",
            [v1, randomUUID()],
          ),
        ),
      ).toMatch(/consignment_agreement_superseded_by_fkey/);
    });

    it("keeps a superseded version as it was signed, for the owner too", async () => {
      const { v1 } = await seedSigned(client);
      await supersede(client, v1, 2, 15);
      for (const change of [
        "commission_percent = 20",
        "accepted_at = now() - interval '1 day'",
        "terms_version = 'v2'",
        "superseded_at = null, superseded_by = null",
        "replaces_agreement_id = id",
        "version = 7",
        "id = gen_random_uuid()",
        "created_at = created_at - interval '1 day'",
        'accepted_by_user_id = (select id from "user" where id <> accepted_by_user_id limit 1)',
        'proposed_by_user_id = (select id from "user" limit 1)',
        'recorded_by_user_id = (select id from "user" limit 1)',
      ]) {
        const error = await refused(() =>
          client.query(
            `update consignment_agreement set ${change}, updated_at = now() where id = $1`,
            [v1],
          ),
        );
        expect(error, change).toMatch(/is superseded/);
      }
      // What is not part of the agreement may still change: a cleared user, reminders, updated_at.
      expect(
        await refused(() =>
          client.query(
            `update consignment_agreement
              set accepted_by_user_id = null, reminder_day3_sent_at = now(), updated_at = now()
            where id = $1`,
            [v1],
          ),
        ),
      ).toBeNull();
    });

    it("refuses deleting a superseded version", async () => {
      const { v1 } = await seedSigned(client);
      const v2 = await supersede(client, v1, 2, 15);
      expect(
        await refused(() => client.query("delete from consignment_agreement where id = $1", [v1])),
      ).toMatch(/never deleted/);
      expect(v2).toBeTruthy();
    });

    it("deletes a consignment with its whole history", async () => {
      const { submissionId, v1 } = await seedSigned(client);
      const v2 = await supersede(client, v1, 2, 15);
      // Version 2 is a recorded correction naming the version it replaces, then is superseded.
      const document = await one(
        client,
        `insert into upload_object (kind, key, declared_content_type, declared_byte_size, expires_at, owner_user_id)
         values ('signed_consignment_agreement', $1, 'application/pdf', 10, now() + interval '1 day', (select id from "user" limit 1))
         returning id`,
        [`k-${randomUUID()}`],
      );
      await client.query(
        `update consignment_agreement
            set source = 'recorded', signed_document_id = $3, record_reason = 'Corrected rate',
                replaces_agreement_id = $2
          where id = $1`,
        [v2, v1, document],
      );
      await supersede(client, v2, 3, 18);
      expect(
        await refused(() =>
          client.query("delete from item_submission where id = $1", [submissionId]),
        ),
      ).toBeNull();
    });
  },
);

const rollbackSql = () =>
  readFile(resolve(import.meta.dirname, "../drizzle/0391_rollback.sql"), "utf8");

describe.skipIf(!url)("migration 0391 rollback", { timeout: 120_000 }, () => {
  it("stops while a version is superseded, then rolls back and applies again", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const db = await pool.connect();
      try {
        await db.query("begin");
        const { submissionId, v1 } = await seedSigned(db);
        await supersede(db, v1, 2, 15);
        await db.query("commit");

        await expect(db.query(await rollbackSql())).rejects.toThrow(/forward-fix only/);
        await db.query("rollback");

        // Undo the version by hand (the owner may lift the guard) so the rollback can run.
        await db.query("begin");
        await db.query(
          "delete from consignment_agreement where submission_id = $1 and superseded_at is null",
          [submissionId],
        );
        await db.query("set local session_replication_role = replica");
        await db.query(
          "update consignment_agreement set superseded_at = null, superseded_by = null where id = $1",
          [v1],
        );
        await db.query("commit");
        await db.query(await rollbackSql());
        const columns = await pool.query(
          `select column_name from information_schema.columns
            where table_name = 'consignment_agreement' and column_name in ('version', 'superseded_at', 'superseded_by')`,
        );
        expect(columns.rowCount).toBe(0);

        await runMigrationsPerTransaction(pool);
        const version = await pool.query<{ version: number }>(
          "select version from consignment_agreement where id = $1",
          [v1],
        );
        expect(version.rows[0]?.version).toBe(1);
      } finally {
        db.release();
      }
    });
  });
});
