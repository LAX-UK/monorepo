import type { Pool } from "pg";

export type ShopUserProfile = {
  identitySubjectId: string;
  email: string | null;
  name: string | null;
  disabledAt: Date | null;
};

export async function upsertShopUserProfile(
  pool: Pool,
  input: { identitySubjectId: string; email?: string | null; name?: string | null },
): Promise<ShopUserProfile> {
  const result = await pool.query<{
    identity_subject_id: string;
    email: string | null;
    name: string | null;
    disabled_at: Date | null;
  }>(
    `
      insert into shop_user_profile (identity_subject_id, email, name, updated_at)
      values ($1, $2, $3, now())
      on conflict (identity_subject_id) do update
      set email = excluded.email,
          name = excluded.name,
          updated_at = now()
      returning identity_subject_id, email, name, disabled_at
    `,
    [input.identitySubjectId, input.email ?? null, input.name ?? null],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to upsert shop_user_profile");
  }
  return {
    identitySubjectId: row.identity_subject_id,
    email: row.email,
    name: row.name,
    disabledAt: row.disabled_at,
  };
}

export async function findShopUserProfile(
  pool: Pool,
  identitySubjectId: string,
): Promise<ShopUserProfile | null> {
  const result = await pool.query<{
    identity_subject_id: string;
    email: string | null;
    name: string | null;
    disabled_at: Date | null;
  }>(
    `
      select identity_subject_id, email, name, disabled_at
      from shop_user_profile
      where identity_subject_id = $1
      limit 1
    `,
    [identitySubjectId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    identitySubjectId: row.identity_subject_id,
    email: row.email,
    name: row.name,
    disabledAt: row.disabled_at,
  };
}

export async function pingShopDatabase(pool: Pool): Promise<void> {
  await pool.query("select 1");
}
