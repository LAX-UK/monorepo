#!/usr/bin/env node
/**
 * Seeds OAuth rows used by hermetic N/N-1 and acceptance preflight gates,
 * including an issued-but-unrefreshed token with null refresh_token_hash.
 */
import { hashOpaqueToken } from "@auction/identity-contracts";
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

async function main() {
  const databaseUrl = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_OWNER or DATABASE_URL is required");
  }

  const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
  await client.connect();
  try {
    const context = await client.query(`
      select c.client_id, u.id as user_id
        from oauth_application c
        cross join "user" u
       where c.client_id = 'lax-shop-web'
         and lower(u.email) = 'admin@lax.bid'
       limit 1
    `);
    const row = context.rows[0];
    if (!row) {
      throw new Error("Expected lax-shop-web client and admin@lax.bid user in seeded database");
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await client.query(
      `insert into "oauth_access_token" (
         id,
         access_token,
         refresh_token,
         refresh_token_hash,
         access_token_expires_at,
         refresh_token_expires_at,
         client_id,
         user_id,
         scopes,
         created_at,
         updated_at
       ) values (
         $1, $2, $3, null, $4, $4, $5, $6, 'openid profile email', now(), now()
       )
       on conflict (id) do update
         set access_token = excluded.access_token,
             refresh_token = excluded.refresh_token,
             refresh_token_hash = excluded.refresh_token_hash,
             updated_at = now()`,
      [
        "acceptance-null-refresh-hash",
        hashOpaqueToken("acceptance-access-unrefreshed"),
        hashOpaqueToken("acceptance-refresh-unrefreshed"),
        expiresAt,
        row.client_id,
        row.user_id,
      ],
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
