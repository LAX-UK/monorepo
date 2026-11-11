import type { DemoPerson } from "../demo/demo-topup-ids.js";

/**
 * Accounts that automated browser checks and screenshot scripts sign in as, so the demo accounts
 * people review (a collector, the administrator) only ever show the devices their owners used.
 * They share the seeded password and are made by `pnpm --filter @auction/db db:seed:check-accounts`.
 */

function id(group: string, n: number): string {
  return `${group}-0000-4000-8000-${n.toString().padStart(12, "0")}`;
}

function checkPerson(n: number, key: string, email: string, last: string): DemoPerson {
  return {
    key,
    userId: id("9ce00000", n),
    email,
    firstName: "Check",
    lastName: last,
    bidStaffRole: null,
    personalEntityId: null,
  };
}

export const CHECK_PEOPLE = {
  /** A buyer with a personal account and verified identity: the signed-in buyer journeys. */
  client: {
    ...checkPerson(1, "client", "check-client@lax.bid", "Buyer"),
    personalEntityId: id("9ce80000", 1),
  },
  /** A person with no works, payments or alerts in any product: the empty states. */
  newPerson: {
    ...checkPerson(2, "newPerson", "check-new-person@lax.bid", "Newcomer"),
    personalEntityId: id("9ce80000", 2),
  },
  /** Bid administrator: the staff screens and sign-in journeys. */
  administrator: {
    ...checkPerson(3, "administrator", "check-admin@lax.bid", "Administrator"),
    bidStaffRole: "administrator",
  },
} as const satisfies Record<string, DemoPerson>;
