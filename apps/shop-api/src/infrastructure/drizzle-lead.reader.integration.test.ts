import { crmRecordLink, shopGuestCustomer } from "@auction/db/schema";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LeadsService } from "../application/leads/leads.service.js";
import { integrationSuffix } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleLeadReader } from "./drizzle-lead.reader.js";

describe.skipIf(!hasShopIntegrationDb)("guest leads for LAX Admin", () => {
  let ownerPool: pg.Pool;
  let shopPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  it("lists leads by tab, search and CRM state, and never an erased one", async () => {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix("leads");
    const now = new Date();
    const [enquirer, buyer, erased] = await db
      .insert(shopGuestCustomer)
      .values([
        {
          email: `enquirer-${suffix}@example.com`,
          name: `Enquirer ${suffix}`,
          source: "art_enquiry",
          enquiryCount: 1,
          lastSeenAt: now,
        },
        {
          email: `buyer-${suffix}@example.com`,
          name: `Buyer ${suffix}`,
          source: "shop_checkout",
          checkoutStartedAt: now,
          paidOrderCount: 1,
          lastSeenAt: now,
        },
        {
          email: `erased:${suffix}`,
          source: "shop_checkout",
          erasedAt: now,
          erasedBySubjectId: "staff",
          lastSeenAt: now,
        },
      ])
      .returning({ id: shopGuestCustomer.id });
    await createShopDb(ownerPool)
      .insert(crmRecordLink)
      .values({
        entityType: "subject",
        entityId: `guest:${buyer?.id}`,
        zohoModule: "Leads",
        zohoRecordId: `zr-${suffix}`,
      });

    const service = new LeadsService(createDrizzleLeadReader(db));
    const all = await service.list({ q: suffix });
    expect(all.items.map((item) => item.leadId).sort()).toEqual([enquirer?.id, buyer?.id].sort());
    expect(all.counts).toMatchObject({ all: 2, enquired: 1, ordered: 1, joined: 0 });

    const enquired = await service.list({ q: suffix, tab: "enquired" });
    expect(enquired.items).toEqual([
      expect.objectContaining({ leadId: enquirer?.id, status: "enquired", crm: "not_sent" }),
    ]);
    const inCrm = await service.list({ q: suffix, crm: "synced" });
    expect(inCrm.items.map((item) => item.leadId)).toEqual([buyer?.id]);

    const detail = await service.get(buyer?.id ?? "");
    expect(detail?.crmRecord).toEqual({ module: "Leads", recordId: `zr-${suffix}` });
    expect(await service.get(erased?.id ?? "")).toBeNull();
  });
});
