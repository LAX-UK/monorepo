#!/usr/bin/env node
/**
 * Inventory foreign keys referencing Identity `user.id` to plan FK removal expand.
 *
 * Usage:
 *   DATABASE_URL_OWNER=... node docs/scripts/identity/fk-removal-inventory.mjs
 *   node docs/scripts/identity/fk-removal-inventory.mjs --json
 */
import pg from "pg";

const { Client } = pg;

async function listUserForeignKeys(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT
        nsp.nspname AS referencing_schema,
        rel.relname AS referencing_table,
        att.attname AS referencing_column,
        fnsp.nspname AS referenced_schema,
        frel.relname AS referenced_table,
        fatt.attname AS referenced_column,
        con.conname AS constraint_name,
        con.convalidated AS validated
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN pg_class frel ON frel.oid = con.confrelid
      JOIN pg_namespace fnsp ON fnsp.oid = frel.relnamespace
      JOIN unnest(con.conkey) WITH ORDINALITY AS src(attnum, ord) ON true
      JOIN unnest(con.confkey) WITH ORDINALITY AS tgt(attnum, ord)
        ON src.ord = tgt.ord
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = src.attnum
      JOIN pg_attribute fatt ON fatt.attrelid = frel.oid AND fatt.attnum = tgt.attnum
      WHERE con.contype = 'f'
        AND frel.relname = 'user'
        AND fatt.attname = 'id'
      ORDER BY referencing_schema, referencing_table, referencing_column
    `);
    return res.rows;
  } finally {
    await client.end();
  }
}

async function main() {
  const asJson = process.argv.includes("--json");
  const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL_OWNER or DATABASE_URL is required");
  }

  const rows = await listUserForeignKeys(url);
  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  console.log(`FK inventory referencing user.id (${rows.length} constraints)`);
  for (const row of rows) {
    const validated = row.validated ? "valid" : "not valid";
    console.log(
      `- ${row.referencing_schema}.${row.referencing_table}.${row.referencing_column} -> ${row.referenced_schema}.${row.referenced_table}.${row.referenced_column} (${row.constraint_name}, ${validated})`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
