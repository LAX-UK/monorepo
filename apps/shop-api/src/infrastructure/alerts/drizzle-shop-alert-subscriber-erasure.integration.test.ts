import { shopAlertSubscriber, shopAlertTopic } from "@auction/db/schema";
import { inArray } from "drizzle-orm";
import type pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { ShopAlertSubscriberEraser } from "./drizzle-shop-alert-subscriber-erasure.js";

let pools: { ownerPool: pg.Pool; shopPool: pg.Pool } | null = null;
afterAll(async () => {
  if (!pools) return;
  await pools.shopPool.end();
  await pools.ownerPool.end();
});

const consent = { consentText: "We'll email you.", consentSource: "test", requestedAt: new Date() };
const tag = Math.random().toString(36).slice(2, 8);
const email = `erase-${tag}@example.com`;
const other = `other-${tag}@example.com`;
const complained = `complained-${tag}@example.com`;

describe.skipIf(!hasShopIntegrationDb)("Shop alert subscriber erasure (integration)", () => {
  it("erases both products by normalised email, keeps complaint suppressions, and is idempotent", async () => {
    pools ??= await setupShopIntegrationPools();
    const db = createShopDb(pools.shopPool);
    const erasure = new ShopAlertSubscriberEraser();

    const [mine] = await db
      .insert(shopAlertSubscriber)
      .values({ product: "shop", email, status: "confirmed", ...consent })
      .returning();
    await db
      .insert(shopAlertTopic)
      .values({ subscriberId: mine?.id as string, topic: "shop.releases", emailOn: true });
    await db.insert(shopAlertSubscriber).values([
      { product: "art", email, status: "confirmed", ...consent },
      { product: "shop", email: other, status: "confirmed", ...consent },
      {
        product: "art",
        email: complained,
        subjectId: "subject_1",
        status: "stopped",
        stopReason: "complaint",
        ...consent,
      },
    ]);

    const first = await db.transaction((tx) =>
      erasure.erase(tx as never, { emails: [`  ${email.toUpperCase()} `, complained] }),
    );
    expect(first).toEqual({ alertSubscribers: 2, suppressionsKept: 1 });

    const left = await db
      .select({ email: shopAlertSubscriber.email, subject: shopAlertSubscriber.subjectId })
      .from(shopAlertSubscriber)
      .where(inArray(shopAlertSubscriber.email, [email, other, complained]));
    expect(left.map((row) => row.email).sort()).toEqual([complained, other].sort());
    expect(left.find((row) => row.email === complained)?.subject).toBeNull();

    const second = await db.transaction((tx) => erasure.erase(tx as never, { emails: [email] }));
    expect(second).toEqual({ alertSubscribers: 0, suppressionsKept: 0 });

    await db
      .delete(shopAlertSubscriber)
      .where(inArray(shopAlertSubscriber.email, [other, complained]));
  });

  it("erases an account's own rows and the email-only row for the same address", async () => {
    pools ??= await setupShopIntegrationPools();
    const db = createShopDb(pools.shopPool);
    const erasure = new ShopAlertSubscriberEraser();
    const accountEmail = `acct-${tag}@example.com`;
    await db.insert(shopAlertSubscriber).values([
      {
        product: "art",
        email: accountEmail,
        subjectId: `acct_${tag}`,
        status: "confirmed",
        ...consent,
      },
      { product: "shop", email: accountEmail, status: "pending", ...consent },
    ]);
    const counts = await db.transaction((tx) =>
      erasure.erase(tx as never, { emails: [], subjectIds: [`acct_${tag}`] }),
    );
    expect(counts).toEqual({ alertSubscribers: 2, suppressionsKept: 0 });
  });

  it("does nothing for an empty target", async () => {
    pools ??= await setupShopIntegrationPools();
    const db = createShopDb(pools.shopPool);
    const counts = await db.transaction((tx) =>
      new ShopAlertSubscriberEraser().erase(tx as never, { emails: [" "] }),
    );
    expect(counts).toEqual({ alertSubscribers: 0, suppressionsKept: 0 });
  });
});
