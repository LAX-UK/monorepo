import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { purgeEnquiryInboundQuarantine } from "../jobs/purge-enquiry-inbound-quarantine.js";
import { DrizzleEnquiryQuarantinePurgeRepository } from "./drizzle-enquiry-quarantine-purge.repository.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

/**
 * Runs the quarantine purge as `worker_app`, the role the nightly job connects with: it fails with
 * `permission denied for table enquiry_inbound_quarantine` if the role lacks SELECT or DELETE.
 */
describe.skipIf(!ownerUrl || !workerUrl)("enquiry quarantine purge as worker_app", () => {
  const tag = randomUUID().slice(0, 8);
  const due = { pending: `due-pending-${tag}`, reviewed: `due-reviewed-${tag}` };
  const kept = `kept-${tag}`;
  let owner: pg.Pool;

  beforeAll(async () => {
    if (!ownerUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
    owner = new pg.Pool({ connectionString: ownerUrl });
    await applyApplicationRoleGrants(ownerUrl);
    await owner.query(
      `insert into enquiry_inbound_quarantine
         (provider_message_id, reason, from_address, subject, body, received_at, purge_at,
          status, reviewed_at)
       values
         ($1, 'unmatched', 'sender@example.test', 'Old', 'Old', now() - interval '31 days',
          now() - interval '1 day', 'pending', null),
         ($2, 'bad_token', 'sender@example.test', 'Old', 'Old', now() - interval '40 days',
          now() - interval '10 days', 'dismissed', now() - interval '35 days'),
         ($3, 'unmatched', 'sender@example.test', 'New', 'New', now(),
          now() + interval '30 days', 'pending', null)`,
      [due.pending, due.reviewed, kept],
    );
  });

  afterAll(async () => {
    if (!owner) return;
    await owner.query(
      "delete from enquiry_inbound_quarantine where provider_message_id = any($1::text[])",
      [[due.pending, due.reviewed, kept]],
    );
    await owner.end();
  });

  it("deletes held mail past purge_at, reviewed or not, keeps the rest, and a second run deletes nothing", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const repository = new DrizzleEnquiryQuarantinePurgeRepository(createDb(workerUrl!));
    const log = { info: () => {} };

    const first = await purgeEnquiryInboundQuarantine({ repository, log });
    expect(first.deleted).toBeGreaterThanOrEqual(2);

    const remaining = await owner.query<{ provider_message_id: string }>(
      "select provider_message_id from enquiry_inbound_quarantine where provider_message_id = any($1::text[])",
      [[due.pending, due.reviewed, kept]],
    );
    expect(remaining.rows.map((row) => row.provider_message_id)).toEqual([kept]);

    const second = await purgeEnquiryInboundQuarantine({ repository, log });
    expect(second).toEqual({ deleted: 0, batches: 0 });
  });
});
