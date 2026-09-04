import pg from "pg";
import { describe, expect, it } from "vitest";
import { SHOP_PRODUCT_PROFILE_TABLES, SHOP_SSF_RECEIVER_TABLES } from "./migrate-roles.js";
import { buildPgConnectionConfig } from "./ssl.js";

const SHOP_URL = process.env.DATABASE_URL_SHOP;
const { Client } = pg;

async function withShopClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  if (!SHOP_URL) throw new Error("DATABASE_URL_SHOP is required");
  const client = new Client(buildPgConnectionConfig(SHOP_URL));
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

describe.skipIf(!SHOP_URL)("shop_app role contract", () => {
  it("has only the required DML on the Shop profile", async () => {
    await withShopClient(async (client) => {
      for (const table of SHOP_PRODUCT_PROFILE_TABLES) {
        for (const privilege of ["INSERT", "SELECT", "UPDATE"]) {
          const result = await client.query<{ allowed: boolean }>(
            "select has_table_privilege(current_user, $1, $2) as allowed",
            [`public.${table}`, privilege],
          );
          expect(result.rows[0]?.allowed, `${table}:${privilege}`).toBe(true);
        }
        const deletePrivilege = await client.query<{ allowed: boolean }>(
          "select has_table_privilege(current_user, $1, 'DELETE') as allowed",
          [`public.${table}`],
        );
        expect(deletePrivilege.rows[0]?.allowed, `${table}:DELETE`).toBe(
          table !== "shop_user_profile",
        );
      }
    });
  });

  it("cannot read Identity or Bid-owned tables", async () => {
    await withShopClient(async (client) => {
      for (const table of [
        "user",
        "session",
        "oauth_application",
        "oidc_rp_session",
        "oidc_backchannel_logout_delivery",
        "bid_user_profile",
        "ssf_stream",
        "ssf_delivery",
        "bid_ssf_replay",
      ]) {
        const result = await client.query<{ allowed: boolean }>(
          "select has_table_privilege(current_user, $1, 'SELECT') as allowed",
          [`public.${table}`],
        );
        expect(result.rows[0]?.allowed, table).toBe(false);
      }
    });
  });

  it("owns only the Shop SSF replay ledger", async () => {
    await withShopClient(async (client) => {
      for (const table of SHOP_SSF_RECEIVER_TABLES) {
        for (const privilege of ["INSERT", "SELECT", "DELETE"]) {
          const result = await client.query<{ allowed: boolean }>(
            "select has_table_privilege(current_user, $1, $2) as allowed",
            [`public.${table}`, privilege],
          );
          expect(result.rows[0]?.allowed, `${table}:${privilege}`).toBe(true);
        }
        const update = await client.query<{ allowed: boolean }>(
          "select has_table_privilege(current_user, $1, 'UPDATE') as allowed",
          [`public.${table}`],
        );
        expect(update.rows[0]?.allowed, `${table}:UPDATE`).toBe(false);
      }
    });
  });
});
