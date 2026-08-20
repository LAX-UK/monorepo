import { type SQL, sql } from "drizzle-orm";

type SqlExecutor = {
  execute(query: SQL): Promise<unknown>;
};

export type IdentityUserFixture = {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Owner-only integration-test fixture. Product tests use this narrow helper
 * because api_app cannot seed or delete Identity-owned rows after migration
 * 0158; application code must never call it.
 */
export async function seedIdentityUserFixtures(
  db: SqlExecutor,
  users: readonly IdentityUserFixture[],
): Promise<void> {
  for (const user of users) {
    const createdAt = user.createdAt ?? new Date();
    const updatedAt = user.updatedAt ?? createdAt;
    await db.execute(sql`
      INSERT INTO public."user" (
        "id", "name", "email", "email_verified", "phone_number",
        "phone_number_verified", "created_at", "updated_at"
      )
      VALUES (
        ${user.id}, ${user.name}, ${user.email}, ${user.emailVerified ?? true},
        ${user.phoneNumber ?? null}, ${user.phoneNumberVerified ?? false},
        ${createdAt}, ${updatedAt}
      )
    `);
  }
}

export async function deleteIdentityUserFixtures(
  db: SqlExecutor,
  userIds: readonly string[],
): Promise<void> {
  if (userIds.length === 0) return;
  await db.execute(sql`DELETE FROM public."user" WHERE "id" = ANY(${userIds}::text[])`);
}
