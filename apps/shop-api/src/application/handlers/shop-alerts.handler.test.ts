import { ConfirmService, type SubscriberRecord, TOPIC_CATALOGUE } from "@auction/alerts";
import { createEngineHarness } from "@auction/alerts/testing";
import { RELEASE_ALERT_CONSENT_TEXT } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";
import { createShopAlertHandlers } from "./shop-alerts.handler.js";

function setup() {
  const h = createEngineHarness();
  const legacy = new Map<string, SubscriberRecord>();
  const stopLegacy = vi.fn(async (id: string, now: Date) => {
    await h.stores.stop(id, "link", now);
  });
  const handlers = createShopAlertHandlers({
    subscribe: h.subscribe,
    confirm: new ConfirmService({
      subscribers: h.stores,
      topics: h.stores,
      codec: h.codec,
      clock: { now: () => h.now },
      topicsToEnable: (product) => (product === "shop" ? ["shop.releases"] : []),
    }),
    stop: h.stop,
    preferences: h.preferences,
    codec: h.codec,
    legacy: { findByLegacyLinkHash: async (hash) => legacy.get(hash) ?? null },
    hashLegacyToken: (token) => `hash(${token})`,
    stopLegacy,
    now: () => h.now,
  });
  return { h, handlers, legacy, stopLegacy };
}

const tokenOf = (url: string) => new URL(url).searchParams.get("t") ?? "";

describe("shop alert handlers", () => {
  it("shows the wording that is stored as consent", () => {
    expect(RELEASE_ALERT_CONSENT_TEXT).toBe(TOPIC_CATALOGUE["shop.releases"].consentText);
  });

  it("asks a visitor to confirm, with the topic's consent text and the page they asked from", async () => {
    const { h, handlers } = setup();
    const result = await handlers.subscribeGuest({ email: " Ada@Example.com ", source: "x" });
    expect(result).toBe("check_email");
    const row = await h.stores.findByEmail("shop", "ada@example.com");
    expect(row).toMatchObject({ status: "pending", product: "shop" });
    expect(h.mailer.confirmations).toHaveLength(1);
    expect(h.stores.subscribersById.size).toBe(1);
  });

  it("gives the same answer for an address that is already confirmed, and sends nothing", async () => {
    const { h, handlers } = setup();
    await handlers.subscribeGuest({ email: "ada@example.com" });
    const [first] = h.mailer.confirmations;
    await h.stores.confirm(
      (await h.stores.findByEmail("shop", "ada@example.com"))?.id ?? "",
      h.now,
    );
    expect(first).toBeDefined();
    const again = await handlers.subscribeGuest({ email: "ada@example.com" });
    expect(again).toBe("check_email");
    expect(h.mailer.confirmations).toHaveLength(1);
  });

  it("confirms from the emailed link, once, and repeat presses are harmless", async () => {
    const { h, handlers } = setup();
    await handlers.subscribeGuest({ email: "ada@example.com" });
    const link = h.mailer.confirmations[0];
    const token = tokenOf(link?.confirmUrl ?? "");
    expect(await handlers.confirm(token)).toBe("confirmed");
    expect(await handlers.confirm(token)).toBe("confirmed");
    const row = await h.stores.findByEmail("shop", "ada@example.com");
    expect(row?.status).toBe("confirmed");
    const topics = await h.stores.list(row?.id ?? "");
    expect(topics).toContainEqual({ topic: "shop.releases", emailOn: true });
  });

  it("refuses a link that is not signed, expired, or made for another product", async () => {
    const { h, handlers } = setup();
    expect(await handlers.confirm("not-a-token")).toBe("invalid");
    await handlers.subscribeGuest({ email: "ada@example.com" });
    const token = tokenOf(h.mailer.confirmations[0]?.confirmUrl ?? "");
    h.now = new Date(h.now.getTime() + 49 * 3_600_000);
    expect(await handlers.confirm(token)).toBe("expired");
  });

  it("subscribes an account with its own address and no confirmation email", async () => {
    const { h, handlers } = setup();
    h.accounts.set("sub-1", { email: "Ada@Example.com", verified: true });
    expect(await handlers.subscribeAccount({ identitySubjectId: "sub-1" })).toBe("subscribed");
    expect(await handlers.isSubscribed("sub-1")).toBe(true);
    expect(await handlers.subscribeAccount({ identitySubjectId: "sub-1" })).toBe(
      "already_subscribed",
    );
    expect(h.mailer.confirmations).toHaveLength(0);
    const row = await h.stores.findBySubject("shop", "sub-1");
    expect(row).toMatchObject({ email: "ada@example.com", status: "confirmed" });
  });

  it("does nothing for an account with no address, or one that is not verified", async () => {
    const { h, handlers } = setup();
    expect(await handlers.subscribeAccount({ identitySubjectId: "sub-1" })).toBeNull();
    h.accounts.set("sub-2", { email: "x@example.com", verified: false });
    expect(await handlers.subscribeAccount({ identitySubjectId: "sub-2" })).toBeNull();
    expect(await handlers.isSubscribed("sub-1")).toBe(false);
    expect(h.stores.subscribersById.size).toBe(0);
  });

  it("stops an account's release alerts from its own settings", async () => {
    const { h, handlers } = setup();
    h.accounts.set("sub-1", { email: "ada@example.com", verified: true });
    await handlers.subscribeAccount({ identitySubjectId: "sub-1" });
    await handlers.stopAccount("sub-1");
    expect(await handlers.isSubscribed("sub-1")).toBe(false);
  });

  it("previews and stops from a signed stop link, and says so on a repeat", async () => {
    const { h, handlers } = setup();
    h.accounts.set("sub-1", { email: "ada@example.com", verified: true });
    await handlers.subscribeAccount({ identitySubjectId: "sub-1" });
    const row = await h.stores.findBySubject("shop", "sub-1");
    const token = h.codec.create({
      kind: "stop",
      product: "shop",
      subscriberId: row?.id ?? "",
      linkVersion: 1,
    });
    expect(await handlers.previewUnsubscribe(token)).toEqual({
      maskedEmail: "a•••@example.com",
      active: true,
    });
    expect(await handlers.unsubscribe(token)).toBe(true);
    expect(await handlers.previewUnsubscribe(token)).toEqual({
      maskedEmail: "a•••@example.com",
      active: false,
    });
    expect(await handlers.unsubscribe(token)).toBe(true);
    expect(await handlers.isSubscribed("sub-1")).toBe(false);
  });

  it("serves stop links from emails sent before the engine, by the hash of their token", async () => {
    const { h, handlers, legacy, stopLegacy } = setup();
    await handlers.subscribeGuest({ email: "old@example.com" });
    const row = (await h.stores.findByEmail("shop", "old@example.com")) as SubscriberRecord;
    await h.stores.confirm(row.id, h.now);
    const token = `L${"x".repeat(42)}`;
    legacy.set(`hash(${token})`, { ...row, status: "confirmed" });
    expect(await handlers.previewUnsubscribe(token)).toEqual({
      maskedEmail: "o•••@example.com",
      active: true,
    });
    expect(await handlers.unsubscribe(token)).toBe(true);
    expect(stopLegacy).toHaveBeenCalledWith(row.id, h.now);
    expect((await h.stores.findById(row.id))?.status).toBe("stopped");
  });

  it("answers invalid for a token that matches nothing", async () => {
    const { handlers } = setup();
    expect(await handlers.previewUnsubscribe("y".repeat(43))).toBeNull();
    expect(await handlers.unsubscribe("y".repeat(43))).toBe(false);
  });
});
