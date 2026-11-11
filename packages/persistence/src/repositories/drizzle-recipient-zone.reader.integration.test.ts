import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { bidIdentityDirectory } from "@auction/db/schema";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DrizzleRecipientZoneReader } from "./drizzle-recipient-zone.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("recipient zone reader (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const reader = new DrizzleRecipientZoneReader(db);
  const tag = randomUUID();
  const ids = {
    sydney: `rz-sydney-${tag}`,
    bad: `rz-bad-${tag}`,
    none: `rz-none-${tag}`,
  };

  beforeAll(async () => {
    const row = (subjectId: string, timeZone: string | null) => ({
      subjectId,
      email: `${subjectId}@integration.test`,
      name: subjectId,
      identityCreatedAt: new Date(),
      timeZone,
    });
    await db
      .insert(bidIdentityDirectory)
      .values([
        row(ids.sydney, "Australia/Sydney"),
        row(ids.bad, "Mars/Olympus_Mons"),
        row(ids.none, null),
      ]);
  });

  afterAll(async () => {
    await db
      .delete(bidIdentityDirectory)
      .where(inArray(bidIdentityDirectory.subjectId, Object.values(ids)));
  });

  it("keeps a usable zone and treats a zone the server cannot use as London, logging it once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const zones = await reader.zonesFor(Object.values(ids));
      expect([...zones.entries()]).toEqual([[ids.sydney, "Australia/Sydney"]]);
      await reader.zonesFor([ids.bad]);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});
