import { randomUUID } from "node:crypto";
import { hashPassword } from "@better-auth/utils/password";
import pg from "pg";

const email = "onboarding-new@lax.bid";
const userId = "onboarding_new_buyer_001";
const password = "Password123!";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const accountId = randomUUID();
  const now = new Date();
  const hash = await hashPassword(password);
  const client = new pg.Client({ connectionString });

  await client.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      'SELECT id FROM "user" WHERE id = $1 OR lower(email) = lower($2) LIMIT 1',
      [userId, email],
    );
    const targetUserId = existing.rows[0]?.id ?? userId;

    if (existing.rowCount) {
      await client.query("DELETE FROM user_category_interest WHERE user_id = $1", [targetUserId]);
      await client.query("DELETE FROM kyc_verification WHERE user_id = $1", [targetUserId]);
      await client.query("DELETE FROM session WHERE user_id = $1", [targetUserId]);
      await client.query("DELETE FROM account WHERE user_id = $1", [targetUserId]);
      await client.query(
        `UPDATE "user"
         SET name = 'Alex Morgan',
             first_name = 'Alex',
             last_name = 'Morgan',
             email = $2,
             email_verified = true,
             image = null,
             role = 'client',
             staff_role = null,
             suspended = false,
             kyc_status = 'unverified',
             current_kyc_session_id = null,
             kyc_retry_count = 0,
             kyc_verified_at = null,
             signup_persona = 'individual',
             category_interests_onboarding_completed_at = null,
             updated_at = $3
         WHERE id = $1`,
        [targetUserId, email, now],
      );
    } else {
      await client.query(
        `INSERT INTO "user" (
        id, name, first_name, last_name, email, email_verified, image, role, staff_role,
        kyc_status, signup_persona, category_interests_onboarding_completed_at,
        created_at, updated_at
      ) VALUES (
        $1, 'Alex Morgan', 'Alex', 'Morgan', $2, true, null, 'client', null,
        'unverified', 'individual', null,
        $3, $3
      )`,
        [targetUserId, email, now],
      );
    }

    await client.query(
      `INSERT INTO account (
        id, account_id, provider_id, user_id, password, created_at, updated_at
      ) VALUES ($1, $2, 'credential', $3, $4, $5, $5)`,
      [accountId, targetUserId, targetUserId, hash, now],
    );
    await client.query("COMMIT");
    console.log(`created:${email}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
