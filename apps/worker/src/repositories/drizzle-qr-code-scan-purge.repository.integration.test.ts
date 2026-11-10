import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleQrCodeScanPurgeRepository } from "./drizzle-qr-code-scan-purge.repository.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

/**
 * Runs the purge as `worker_app`, the role the nightly job connects with. It fails with
 * `permission denied for table qr_code_scan` if the role lacks DELETE on the scan table.
 */
describe.skipIf(!ownerUrl || !workerUrl)("QR code scan purge repository as worker_app", () => {
  const tag = randomUUID().slice(0, 8);
  const qrCodeId = randomUUID();
  const oldScanId = randomUUID();
  const recentScanId = randomUUID();
  let owner: pg.Pool;

  beforeAll(async () => {
    if (!ownerUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
    owner = new pg.Pool({ connectionString: ownerUrl });
    await applyApplicationRoleGrants(ownerUrl);
    await owner.query(
      `insert into qr_code (id, short_code, entity_type, entity_id)
       values ($1, $2, 'sale', $3)`,
      [qrCodeId, `purge-${tag}`, randomUUID()],
    );
    await owner.query(
      `insert into qr_code_scan (id, qr_code_id, scanned_at)
       values ($1, $3, now() - interval '120 days'), ($2, $3, now())`,
      [oldScanId, recentScanId, qrCodeId],
    );
  });

  afterAll(async () => {
    if (!owner) return;
    await owner.query("delete from qr_code where id = $1", [qrCodeId]);
    await owner.end();
  });

  it("deletes scans older than the cutoff and keeps recent ones", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const repository = new DrizzleQrCodeScanPurgeRepository(createDb(workerUrl!));
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const result = await repository.purgeBefore(cutoff, 1000);

    expect(result.deleted).toBeGreaterThanOrEqual(1);
    const remaining = await owner.query<{ id: string }>(
      "select id from qr_code_scan where qr_code_id = $1",
      [qrCodeId],
    );
    expect(remaining.rows.map((row) => row.id)).toEqual([recentScanId]);
  });
});
