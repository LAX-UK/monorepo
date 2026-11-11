import { hashPassword } from "@better-auth/utils/password";
import { DEMO_PASSWORD, type DemoPerson } from "../demo/demo-topup-ids.js";
import { type Db, ensurePerson } from "../demo/demo-topup-seed.js";
import { CHECK_PEOPLE } from "./check-accounts.js";

export type CheckAccountsResult = { created: string[]; existing: string[] };

/** Adds the check accounts that are missing. Additive and idempotent: it never changes a row. */
export async function runCheckAccountsSeed(
  db: Db,
  now: number = Date.now(),
): Promise<CheckAccountsResult> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const result: CheckAccountsResult = { created: [], existing: [] };
  for (const person of Object.values(CHECK_PEOPLE) as DemoPerson[]) {
    const { created } = await ensurePerson(db, person, passwordHash, now);
    (created ? result.created : result.existing).push(person.email);
  }
  return result;
}
