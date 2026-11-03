import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) =>
  readFileSync(join(drizzleDir, name), "utf8").replaceAll("--> statement-breakpoint", "");

/** Runs in one transaction that is always rolled back. */
describe.skipIf(!migrationUrl)("migration 0278 enquiry draft uploads", { timeout: 30_000 }, () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client(buildPgConnectionConfig(migrationUrl as string));
    await client.connect();
  });

  afterAll(async () => {
    await client.query("rollback");
    await client.end();
  });

  beforeEach(async () => {
    await client.query("rollback");
    await client.query("begin");
    await client.query(read("0278_rollback.sql"));
    await client.query(read("0278_enquiry_draft_uploads.sql"));
  });

  const insert = (owner: string | null, draft: string | null, key: string) =>
    client.query(
      `insert into upload_object (owner_user_id, enquiry_draft_id, kind, key, declared_content_type,
         declared_byte_size, expires_at)
       values ($1, $2, 'enquiry_image', $3, 'image/jpeg', 10, now() + interval '1 day')`,
      [owner, draft, key],
    );

  async function seedUser(): Promise<string> {
    const id = `probe-${Math.random().toString(36).slice(2)}`;
    await client.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at)
       values ($1, 'Probe', $1 || '@example.com', true, now(), now())`,
      [id],
    );
    return id;
  }

  it("accepts a file owned by a draft", async () => {
    await insert(null, "6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a11", "k-draft");
    const rows = await client.query(
      "select enquiry_draft_id from upload_object where key = 'k-draft'",
    );
    expect(rows.rows).toHaveLength(1);
  });

  it("accepts a file owned by a user", async () => {
    await insert(await seedUser(), null, "k-user");
    const rows = await client.query("select owner_user_id from upload_object where key = 'k-user'");
    expect(rows.rows).toHaveLength(1);
  });

  it("refuses a file with no owner and a file with two", async () => {
    await expect(insert(null, null, "k-none")).rejects.toThrow(/upload_object_single_owner_check/);
    await client.query("rollback");
    await client.query("begin");
    await client.query(read("0278_rollback.sql"));
    await client.query(read("0278_enquiry_draft_uploads.sql"));
    const owner = await seedUser();
    await expect(insert(owner, "6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a11", "k-both")).rejects.toThrow(
      /upload_object_single_owner_check/,
    );
  });

  it("rolls back to user-owned files only", async () => {
    const owner = await seedUser();
    await insert(owner, null, "k-keep");
    await insert(null, "6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a11", "k-drop");
    await client.query(read("0278_rollback.sql"));
    const rows = await client.query("select key from upload_object where key like 'k-%'");
    expect(rows.rows).toEqual([{ key: "k-keep" }]);
  });
});
