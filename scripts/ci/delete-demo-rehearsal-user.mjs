#!/usr/bin/env node
/**
 * Remove a disposable demo rehearsal Identity user and related Bid directory rows.
 * Refuses non-rehearsal emails unless DEMO_USER_DELETE_CONFIRM=I_UNDERSTAND.
 */
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

const email = process.env.DEMO_REHEARSAL_USER_EMAIL?.trim()?.toLowerCase();
const databaseUrl = process.env.DATABASE_URL_OWNER;

function isRehearsalEmail(value) {
  return (
    /demo\.rehearsal\+/i.test(value) ||
    /\+lax-.*-acceptance/i.test(value) ||
    value.endsWith("@example.com")
  );
}

async function main() {
  if (!databaseUrl || !email) {
    throw new Error("DATABASE_URL_OWNER and DEMO_REHEARSAL_USER_EMAIL are required");
  }
  if (!isRehearsalEmail(email) && process.env.DEMO_USER_DELETE_CONFIRM !== "I_UNDERSTAND") {
    throw new Error(
      "Refusing delete: email does not match rehearsal patterns; set DEMO_USER_DELETE_CONFIRM=I_UNDERSTAND to override",
    );
  }

  const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
  await client.connect();
  try {
    await client.query("begin");
    const users = await client.query(
      'select id from public."user" where lower(email) = $1 for update',
      [email],
    );
    const userIds = users.rows.map((row) => row.id);
    if (userIds.length === 0) {
      await client.query("commit");
      console.log(`delete-demo-rehearsal-user: no user for ${email}`);
      return;
    }
    await client.query(
      "delete from public.legal_entity where created_by_user_id = any($1::text[])",
      [userIds],
    );
    await client.query(
      "delete from public.bid_identity_directory where subject_id = any($1::text[]) or merged_into_subject_id = any($1::text[])",
      [userIds],
    );
    await client.query("delete from public.bid_user_profile where user_id = any($1::text[])", [
      userIds,
    ]);
    await client.query('delete from public."user" where id = any($1::text[])', [userIds]);
    await client.query("commit");
    console.log(`delete-demo-rehearsal-user: removed ${userIds.length} user(s) for ${email}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
