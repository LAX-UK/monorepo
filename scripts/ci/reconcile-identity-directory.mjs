#!/usr/bin/env node
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

const connectionString = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
const apply = process.argv.includes("--apply");

if (!connectionString) {
  throw new Error("DATABASE_URL_OWNER or DATABASE_URL is required");
}

const client = new pg.Client(buildPgConnectionConfig(connectionString));

try {
  await client.connect();
  await client.query("BEGIN");
  const { rows } = await client.query(`
    WITH mismatched AS (
      SELECT d.subject_id
      FROM public."user" u
      JOIN public.bid_identity_directory d ON d.subject_id = u.id
      WHERE u.merged_into_subject_id IS NULL
        AND d.merged_into_subject_id IS NULL
        AND (
          d.email IS DISTINCT FROM u.email
          OR d.name IS DISTINCT FROM u.name
          OR d.image IS DISTINCT FROM u.image
          OR d.phone IS DISTINCT FROM u.phone_number
          OR d.email_verified IS DISTINCT FROM u.email_verified
          OR d.deletion_requested_at IS DISTINCT FROM u.deletion_requested_at
          OR d.identity_created_at IS DISTINCT FROM u.created_at
        )
    )
    SELECT count(*)::int AS mismatch_count FROM mismatched
  `);
  const mismatchCount = Number(rows[0]?.mismatch_count ?? 0);

  if (!apply) {
    await client.query("ROLLBACK");
    console.log(`identity directory reconciliation dry-run: mismatched=${mismatchCount}`);
  } else {
    const result = await client.query(`
      UPDATE public.bid_identity_directory d
      SET email = u.email,
          name = u.name,
          image = u.image,
          phone = u.phone_number,
          email_verified = u.email_verified,
          deletion_requested_at = u.deletion_requested_at,
          identity_created_at = u.created_at,
          replicated_at = now()
      FROM public."user" u
      WHERE d.subject_id = u.id
        AND u.merged_into_subject_id IS NULL
        AND d.merged_into_subject_id IS NULL
        AND (
          d.email IS DISTINCT FROM u.email
          OR d.name IS DISTINCT FROM u.name
          OR d.image IS DISTINCT FROM u.image
          OR d.phone IS DISTINCT FROM u.phone_number
          OR d.email_verified IS DISTINCT FROM u.email_verified
          OR d.deletion_requested_at IS DISTINCT FROM u.deletion_requested_at
          OR d.identity_created_at IS DISTINCT FROM u.created_at
        )
    `);
    await client.query("COMMIT");
    console.log(
      `identity directory reconciliation applied: expected=${mismatchCount} updated=${result.rowCount}`,
    );
    if (result.rowCount !== mismatchCount) {
      throw new Error("identity_directory_reconciliation_concurrent_change");
    }
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
