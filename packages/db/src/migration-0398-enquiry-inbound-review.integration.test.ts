import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  runMigrationsPerTransaction,
  runMigrationsPerTransactionThrough,
} from "./migrate-runner.js";
import { laterRollbackSql } from "./testing/later-rollbacks.js";
import { withTemporaryDatabase } from "./testing/temporary-database.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
/** The journal time of 0397, the migration before 0398. */
const THROUGH_0397 = 1812542400000;

const rollbackSql = () =>
  readFile(resolve(import.meta.dirname, "../drizzle/0398_rollback.sql"), "utf8");

describe.skipIf(!url)("migration 0398 enquiry inbound review", { timeout: 180_000 }, () => {
  it("keeps held mail, lets staff attach it, rolls back to pending and applies again", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, THROUGH_0397);
      const enquiry = await pool.query<{ id: string }>(
        `insert into marketing_enquiry (topic, name, email, message)
         values ('buying', 'Sam Sender', 'sam@example.test', 'Hello') returning id`,
      );
      const enquiryId = enquiry.rows[0]?.id as string;
      const held = await pool.query<{ id: string }>(
        `insert into enquiry_inbound_quarantine
           (provider_message_id, reason, from_address, subject, body, suspected_enquiry_id)
         values ('pm-0398', 'sender_mismatch', 'colleague@example.test', 'Re', 'Text', $1)
         returning id`,
        [enquiryId],
      );
      const heldId = held.rows[0]?.id as string;

      await runMigrationsPerTransaction(pool);

      // Held mail from before the migration has no recorded result, and stays held.
      const before = await pool.query<{ spf_result: string | null; status: string }>(
        "select spf_result, status from enquiry_inbound_quarantine where id = $1",
        [heldId],
      );
      expect(before.rows[0]).toEqual({ spf_result: null, status: "pending" });

      // The new reason and results are accepted; anything else is refused.
      await pool.query(
        `insert into enquiry_inbound_quarantine
           (provider_message_id, reason, from_address, subject, body, spf_result, dkim_result)
         values ('pm-unauth', 'unauthenticated', 'x@example.test', 'S', 'B', 'neutral', 'pass_unaligned')`,
      );
      await expect(
        pool.query(
          `insert into enquiry_inbound_quarantine
             (provider_message_id, reason, from_address, subject, body, dkim_result)
           values ('pm-bad', 'unmatched', 'x@example.test', 'S', 'B', 'maybe')`,
        ),
      ).rejects.toThrow(/dkim_result_check/);

      // A person attaches the held mail, with why it was held and the reason they gave.
      await pool.query(
        `insert into marketing_enquiry_message
           (enquiry_id, direction, subject, body, provider_message_id, matched_by, spf_result,
            dkim_result, held_reason, review_reason)
         values ($1, 'inbound', 'Re', 'Text', 'pm-0398', 'staff', 'pass_unaligned', 'none',
                 'sender_mismatch', 'Client confirmed by phone it is their colleague')`,
        [enquiryId],
      );
      // A held reason or a review reason belongs only on a message staff attached.
      await expect(
        pool.query(
          `insert into marketing_enquiry_message
             (enquiry_id, direction, subject, body, provider_message_id, matched_by, held_reason)
           values ($1, 'inbound', 'Re', 'Text', 'pm-token', 'token', 'unmatched')`,
          [enquiryId],
        ),
      ).rejects.toThrow(/held_reason_check/);
      await expect(
        pool.query(
          `insert into marketing_enquiry_message
             (enquiry_id, direction, subject, body, provider_message_id, matched_by, review_reason)
           values ($1, 'inbound', 'Re', 'Text', 'pm-long', 'staff', repeat('x', 501))`,
          [enquiryId],
        ),
      ).rejects.toThrow(/review_reason_check/);
      await pool.query(
        `update enquiry_inbound_quarantine
            set status = 'linked', reviewed_at = now() where id = $1`,
        [heldId],
      );

      await pool.query(laterRollbackSql(398));
      await pool.query(await rollbackSql());

      const messages = await pool.query("select 1 from marketing_enquiry_message");
      expect(messages.rowCount).toBe(0);
      const after = await pool.query<{ status: string; reviewed_at: Date | null; reason: string }>(
        "select status, reviewed_at, reason from enquiry_inbound_quarantine order by provider_message_id",
      );
      expect(after.rows).toEqual([
        { status: "pending", reviewed_at: null, reason: "sender_mismatch" },
        { status: "pending", reviewed_at: null, reason: "spf_failed" },
      ]);
      const columns = await pool.query(
        `select 1 from information_schema.columns
          where table_name in ('enquiry_inbound_quarantine', 'marketing_enquiry_message')
            and column_name in ('spf_result', 'dkim_result', 'held_reason', 'review_reason')`,
      );
      expect(columns.rowCount).toBe(0);
      await expect(
        pool.query(
          `insert into marketing_enquiry_message
             (enquiry_id, direction, subject, body, provider_message_id, matched_by)
           values ($1, 'inbound', 'Re', 'Text', 'pm-staff', 'staff')`,
          [enquiryId],
        ),
      ).rejects.toThrow(/inbound_check/);

      await runMigrationsPerTransaction(pool);
      const again = await pool.query(
        `select 1 from information_schema.columns
          where table_name = 'enquiry_inbound_quarantine' and column_name = 'dkim_result'`,
      );
      expect(again.rowCount).toBe(1);
    });
  });
});
