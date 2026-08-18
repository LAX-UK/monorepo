import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const OWNER_URL = process.env.DATABASE_URL_OWNER;
const API_URL = process.env.DATABASE_URL_API;
const { Client } = pg;

describe.skipIf(!OWNER_URL || !API_URL)("Bid profile legacy synchronization contract", () => {
  it("lets api_app update the profile while the owner trigger mirrors legacy columns", async () => {
    const subjectId = randomUUID();
    const owner = new Client(buildPgConnectionConfig(OWNER_URL as string));
    const api = new Client(buildPgConnectionConfig(API_URL as string));
    await owner.connect();
    await api.connect();
    try {
      await owner.query(
        `insert into public."user" (id, name, email, created_at, updated_at)
         values ($1, 'Contract User', $2, now(), now())`,
        [subjectId, `${subjectId}@example.test`],
      );
      await owner.query(
        `insert into public.bid_user_profile (user_id, created_at, updated_at)
         values ($1, now(), now())`,
        [subjectId],
      );

      await api.query(
        `update public.bid_user_profile
         set role = 'staff', staff_role = 'operations', kyc_retry_count = 3, updated_at = now()
         where user_id = $1`,
        [subjectId],
      );
      const mirrored = await owner.query<{
        role: string;
        staff_role: string | null;
        kyc_retry_count: number;
      }>(
        `select role, staff_role, kyc_retry_count
         from public."user" where id = $1`,
        [subjectId],
      );
      expect(mirrored.rows[0]).toEqual({
        role: "staff",
        staff_role: "operations",
        kyc_retry_count: 3,
      });
    } finally {
      await owner
        .query(`delete from public."user" where id = $1`, [subjectId])
        .catch(() => undefined);
      await api.end();
      await owner.end();
    }
  });
});
