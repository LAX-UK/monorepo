import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { notification, user } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BID_ANONYMISATION_RULES } from "./bid-personal-data-policy.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

/**
 * Erasing an account empties the message of its identity-check notices, run as `worker_app` so a
 * missing grant fails here. Other notices and other people's rows are left as they are.
 */
describe.skipIf(!ownerUrl || !workerUrl)("anonymising identity-check notices (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const subject = `notice-anon-subject-${run}`;
  const other = `notice-anon-other-${run}`;
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const owner = createDb(ownerUrl!);
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const worker = createDb(workerUrl!);
  const rule = BID_ANONYMISATION_RULES.find((r) => r.table === "notification");

  beforeAll(async () => {
    for (const id of [subject, other]) {
      await owner.insert(user).values({
        id,
        name: id,
        email: `${id}@integration.test`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  });

  afterAll(async () => {
    // Notices go with their user.
    await owner.delete(user).where(inArray(user.id, [subject, other]));
  });

  const messageOf = async (id: string) => {
    const [row] = await owner
      .select({ message: notification.message })
      .from(notification)
      .where(eq(notification.id, id));
    return row?.message;
  };

  it("empties the message of identity-check notices only, and only for the person erased", async () => {
    if (!rule) throw new Error("No notification rule in the policy");
    const rows = await owner
      .insert(notification)
      .values([
        { userId: subject, type: "kyc_resubmission_required", title: "More", message: "Quote A" },
        { userId: subject, type: "kyc_approved", title: "Verified", message: "You are verified" },
        { userId: other, type: "kyc_resubmission_required", title: "More", message: "Quote B" },
      ])
      .returning({ id: notification.id });
    const [erased, kept, stranger] = rows.map((r) => r.id);

    const count = await worker.transaction((tx) =>
      rule.apply(tx as never, {
        subjectIds: [subject],
        personalLegalEntityIds: [],
        pseudonym: "Deleted user 7F3A",
      }),
    );

    expect(count).toBe(1);
    expect(await messageOf(erased as string)).toBe("");
    expect(await messageOf(kept as string)).toBe("You are verified");
    expect(await messageOf(stranger as string)).toBe("Quote B");
  });
});
