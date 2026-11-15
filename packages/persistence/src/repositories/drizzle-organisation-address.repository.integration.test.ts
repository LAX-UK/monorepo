import { randomUUID } from "node:crypto";
import { closeDb, createDb } from "@auction/db";
import { legalEntity, legalEntityAddress, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleLegalEntityReader } from "./drizzle-legal-entity.reader.js";
import { DrizzleOrganisationAddressRepository } from "./drizzle-organisation-address.repository.js";

const OWNER_URL = process.env.DATABASE_URL;
const API_URL = process.env.DATABASE_URL_API;
const HAS_DB = Boolean(OWNER_URL);

const ADDRESS = {
  line1: "7 Dock Road",
  line2: null,
  city: "Bristol",
  region: null,
  postalCode: "BS1 4XX",
  country: "GB",
};

describe.skipIf(!HAS_DB)("organisation addresses (integration)", { timeout: 60_000 }, () => {
  // Fixtures as the owner; the repository runs as the API's least-privilege role when configured.
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const owner = createDb(OWNER_URL!);
  const api = createDb(API_URL || (OWNER_URL as string));
  const repo = new DrizzleOrganisationAddressRepository(api);
  const tag = randomUUID().slice(0, 8);
  const userId = `org-addr-${tag}`;
  const orgId = randomUUID();
  const otherOrgId = randomUUID();

  beforeAll(async () => {
    const now = new Date();
    await owner.insert(user).values({
      id: userId,
      name: "Owner",
      email: `${userId}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    const organisation = (id: string) => ({
      id,
      displayName: id,
      kind: "organisation" as const,
      subkind: "gallery" as const,
      createdByUserId: userId,
      status: "approved" as const,
    });
    await owner.insert(legalEntity).values([organisation(orgId), organisation(otherOrgId)]);
  });

  afterAll(async () => {
    await owner.delete(legalEntity).where(eq(legalEntity.id, orgId));
    await owner.delete(legalEntity).where(eq(legalEntity.id, otherOrgId));
    await owner.delete(user).where(eq(user.id, userId));
    await closeDb(owner);
    await closeDb(api);
  });

  it("lists nothing for an organisation with no address", async () => {
    expect(await repo.list(orgId)).toEqual([]);
  });

  it("lists the registered address first, then delivery addresses oldest first", async () => {
    await owner.insert(legalEntityAddress).values([
      // Another kind of address is neither registered nor for delivery.
      {
        legalEntityId: orgId,
        addressType: "collection",
        line1: "Dock",
        city: "X",
        postalCode: "X1",
        country: "GB",
      },
      {
        legalEntityId: orgId,
        addressType: "registered_office",
        line1: "1 Cork Street",
        city: "London",
        postalCode: "W1S 3LL",
        country: "GB",
      },
    ]);
    const first = await repo.addDelivery(orgId, ADDRESS);
    const second = await repo.addDelivery(orgId, { ...ADDRESS, line1: "9 Quay", region: "Avon" });
    expect(first).toMatchObject({ kind: "delivery", line1: "7 Dock Road", region: null });
    const listed = await repo.list(orgId);
    expect(listed.map((a) => [a.kind, a.line1])).toEqual([
      ["registered", "1 Cork Street"],
      ["delivery", "7 Dock Road"],
      ["delivery", "9 Quay"],
    ]);
    expect(listed[2]).toMatchObject({ id: second.id, region: "Avon" });
  });

  it("never shows another organisation's addresses", async () => {
    expect(await repo.list(otherOrgId)).toEqual([]);
    await repo.addDelivery(otherOrgId, { ...ADDRESS, line1: "Other" });
    expect((await repo.list(orgId)).map((a) => a.line1)).not.toContain("Other");
  });

  it("keeps a delivery address out of the bill-to address", async () => {
    const reader = new DrizzleLegalEntityReader(api);
    // The organisation has only a delivery address: invoices have no address to print.
    const onlyDelivery = randomUUID();
    await owner.insert(legalEntity).values({
      id: onlyDelivery,
      displayName: onlyDelivery,
      kind: "organisation",
      subkind: "gallery",
      createdByUserId: userId,
      status: "approved",
    });
    await repo.addDelivery(onlyDelivery, ADDRESS);
    expect(await reader.findPreferredBillToLegalEntityAddress(onlyDelivery)).toBeNull();
    expect(await reader.findPrimaryAddressForXero(onlyDelivery)).toBeNull();
    // With a registered address it is the one printed, however many delivery addresses follow.
    expect((await reader.findPreferredBillToLegalEntityAddress(orgId))?.line1).toBe(
      "1 Cork Street",
    );
    await owner.delete(legalEntity).where(eq(legalEntity.id, onlyDelivery));
  });
});
