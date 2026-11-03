import { emailOutbox, shopReleaseAlertSubscription } from "@auction/db/schema";
import { RELEASE_ALERT_CONFIRM_TTL_MS, RELEASE_ALERT_RESEND_AFTER_MS } from "@auction/shop-domain";
import { eq, like } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createReleaseAlertHandlers } from "../application/handlers/release-alerts.handler.js";
import { integrationSuffix, requireDefined } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleReleaseAlertStore } from "./drizzle-release-alert.store.js";
import { createDrizzleShopNotificationPublisher } from "./drizzle-shop-notification.publisher.js";

const SHOP_ORIGIN = "http://localhost:3020";
const consent = { text: "consent", source: "shop_home" };

describe.skipIf(!hasShopIntegrationDb)("release alert list", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  function setup() {
    const db = createShopDb(shopPool);
    const store = createDrizzleReleaseAlertStore(db, {
      notifications: createDrizzleShopNotificationPublisher(),
      shopOrigin: SHOP_ORIGIN,
    });
    return { db, store };
  }

  async function mailTo(address: string) {
    const { db } = setup();
    return db
      .select({ template: emailOutbox.template, vars: emailOutbox.vars })
      .from(emailOutbox)
      .where(like(emailOutbox.toSnapshot, address))
      .orderBy(emailOutbox.createdAt);
  }

  function tokenIn(url: unknown): string {
    return requireDefined(new URL(String(url)).searchParams.get("token"), "token in link");
  }

  async function rowOf(address: string) {
    const { db } = setup();
    const [row] = await db
      .select()
      .from(shopReleaseAlertSubscription)
      .where(eq(shopReleaseAlertSubscription.email, address));
    return requireDefined(row, "subscription row");
  }

  it("confirms an address from the emailed link, once, and keeps repeat clicks harmless", async () => {
    const { store } = setup();
    const email = `visitor-${integrationSuffix("a")}@example.com`;
    const now = new Date();
    await store.requestConfirmation({ email, consent, now });

    const [mail] = await mailTo(email);
    expect(mail?.template).toBe("shop-release-alert-confirm");
    expect(mail?.vars).toMatchObject({ expirationHours: 48 });
    const token = tokenIn(mail?.vars.confirmUrl);
    expect((await rowOf(email)).status).toBe("pending");
    expect(await store.isConfirmed(email)).toBe(false);

    expect(await store.confirm(token, now)).toBe("confirmed");
    expect(await store.confirm(token, now)).toBe("confirmed");
    expect(await store.isConfirmed(email)).toBe(true);
    expect(await store.confirm("x".repeat(43), now)).toBe("invalid");
  });

  it("does not store the confirmation token itself, only a hash", async () => {
    const { store } = setup();
    const email = `visitor-${integrationSuffix("hash")}@example.com`;
    await store.requestConfirmation({ email, consent, now: new Date() });
    const token = tokenIn((await mailTo(email))[0]?.vars.confirmUrl);
    const row = await rowOf(email);
    expect(row.confirmTokenHash).not.toBeNull();
    expect(row.confirmTokenHash).not.toBe(token);
  });

  it("sends one email for a quick second request, and none to a confirmed address", async () => {
    const { store } = setup();
    const email = `visitor-${integrationSuffix("b")}@example.com`;
    const now = new Date();
    await store.requestConfirmation({ email, consent, now });
    await store.requestConfirmation({ email, consent, now: new Date(now.getTime() + 1000) });
    expect(await mailTo(email)).toHaveLength(1);

    const later = new Date(now.getTime() + RELEASE_ALERT_RESEND_AFTER_MS);
    await store.requestConfirmation({ email, consent, now: later });
    const mails = await mailTo(email);
    expect(mails).toHaveLength(2);

    // The older link is replaced by the newer one.
    const [older, newer] = mails.map((mail) => tokenIn(mail.vars.confirmUrl));
    expect(await store.confirm(requireDefined(older, "older"), later)).toBe("invalid");
    expect(await store.confirm(requireDefined(newer, "newer"), later)).toBe("confirmed");

    await store.requestConfirmation({
      email,
      consent,
      now: new Date(later.getTime() + RELEASE_ALERT_RESEND_AFTER_MS),
    });
    expect(await mailTo(email)).toHaveLength(2);
  });

  it("expires a link after 48 hours", async () => {
    const { store } = setup();
    const email = `visitor-${integrationSuffix("c")}@example.com`;
    const now = new Date();
    await store.requestConfirmation({ email, consent, now });
    const token = tokenIn((await mailTo(email))[0]?.vars.confirmUrl);
    const late = new Date(now.getTime() + RELEASE_ALERT_CONFIRM_TTL_MS + 1000);
    expect(await store.confirm(token, late)).toBe("expired");
    expect(await store.isConfirmed(email)).toBe(false);
  });

  it("stops from the link in an email, repeats safely, and lets the person ask again", async () => {
    const { store } = setup();
    const email = `visitor-${integrationSuffix("d")}@example.com`;
    const now = new Date();
    await store.requestConfirmation({ email, consent, now });
    const confirmToken = tokenIn((await mailTo(email))[0]?.vars.confirmUrl);
    await store.confirm(confirmToken, now);
    const unsubscribeToken = tokenIn((await mailTo(email))[0]?.vars.unsubscribeUrl);

    expect(await store.previewUnsubscribe(unsubscribeToken)).toEqual({ email, active: true });
    expect(await store.unsubscribe(unsubscribeToken, now)).toBe(true);
    expect(await store.unsubscribe(unsubscribeToken, now)).toBe(true);
    expect(await store.previewUnsubscribe(unsubscribeToken)).toEqual({ email, active: false });
    expect(await store.isConfirmed(email)).toBe(false);
    expect(await store.unsubscribe("y".repeat(43), now)).toBe(false);
    // A stopped address cannot be revived by its old confirmation link.
    expect(await store.confirm(confirmToken, now)).toBe("invalid");

    await store.requestConfirmation({ email, consent, now: new Date(now.getTime() + 1000) });
    expect((await mailTo(email)).map((mail) => mail.template)).toEqual([
      "shop-release-alert-confirm",
      "shop-release-alert-confirm",
    ]);
    // The stop link stays the same, so it still works from the first email.
    expect(tokenIn((await mailTo(email))[1]?.vars.unsubscribeUrl)).toBe(unsubscribeToken);
  });

  it("subscribes a signed-in shopper at once, reports the state, and stops by account", async () => {
    const { db, store } = setup();
    const email = `member-${integrationSuffix("e")}@example.com`;
    const subject = `release-subject-${integrationSuffix("e")}`;
    const alerts = createReleaseAlertHandlers({ store, accountEmail: async () => email });

    expect(await alerts.isSubscribed(subject)).toBe(false);
    expect(await alerts.subscribeAccount({ identitySubjectId: subject })).toBe("subscribed");
    expect(await alerts.subscribeAccount({ identitySubjectId: subject })).toBe(
      "already_subscribed",
    );
    expect(await alerts.isSubscribed(subject)).toBe(true);
    expect(await mailTo(email)).toHaveLength(0);
    expect((await rowOf(email)).identitySubjectId).toBe(subject);

    await alerts.stopAccount(subject);
    expect(await alerts.isSubscribed(subject)).toBe(false);
    expect((await rowOf(email)).status).toBe("stopped");
    expect(db).toBeDefined();
  });

  it("counts the confirmed and the waiting", async () => {
    const { store } = setup();
    const before = await store.counts();
    const now = new Date();
    const one = `count-${integrationSuffix("f")}@example.com`;
    const two = `count-${integrationSuffix("g")}@example.com`;
    await store.requestConfirmation({ email: one, consent, now });
    await store.subscribeAccount({
      email: two,
      identitySubjectId: `count-subject-${integrationSuffix("g")}`,
      consent,
      now,
    });
    const after = await store.counts();
    expect(after.awaitingConfirmation - before.awaitingConfirmation).toBe(1);
    expect(after.confirmed - before.confirmed).toBe(1);
  });
});
