import { AlertLinkCodec } from "@auction/alerts";
import { MemoryAlertStores } from "@auction/alerts/testing";
import { describe, expect, it } from "vitest";
import { createBackInStockLinks } from "./back-in-stock-links.js";
import { shopAlertUrls } from "./shop-alert-urls.js";

const key = { id: "k1", secret: "links-test-secret-0123456789abcdef" }; // gitleaks:allow
const now = new Date("2026-11-16T10:00:00Z");
const before = new Date("2026-11-16T09:00:00Z");
const after = new Date("2026-11-16T11:00:00Z");

function setup() {
  const stores = new MemoryAlertStores();
  const codec = new AlertLinkCodec({ signing: key, accepted: [key] });
  /** When each subscriber said no, as the engine's tables record it. */
  const stops = new Map<string, Date>();
  const links = createBackInStockLinks({
    subscribers: stores,
    topics: stores,
    stopTimes: { stoppedSince: async (id) => stops.get(id) ?? null },
    codec,
    urls: shopAlertUrls("https://shop.lax.art", "https://account.lax.art/alerts"),
    clock: { now: () => now },
  });
  return { stores, codec, links, stops };
}

describe("back in stock engine links", () => {
  it("gives a guest a signed stop link on the shared stop address, with no manage link", async () => {
    const { stores, codec, links } = setup();
    const link = await links.linkFor({
      email: " Ada@Example.com ",
      subjectId: null,
      requestedAt: now,
    });
    expect(link.stopped).toBe(false);
    expect(link.manageUrl).toBeNull();
    expect(link.stopUrl.startsWith("https://shop.lax.art/release-alerts/unsubscribe?token=")).toBe(
      true,
    );
    const payload = codec.verify(link.token, now)?.payload;
    expect(payload).toMatchObject({ kind: "stop", product: "shop", topic: "shop.back_in_stock" });
    // An unverified address is only pending, so it never receives release alerts.
    const row = await stores.findByEmail("shop", "ada@example.com");
    expect(row?.status).toBe("pending");
    expect((await stores.list(row?.id ?? "")).map((t) => [t.topic, t.emailOn])).toEqual([
      ["shop.back_in_stock", true],
    ]);
  });

  it("records an account holder as confirmed and gives the manage link", async () => {
    const { stores, links } = setup();
    const link = await links.linkFor({
      email: "ada@example.com",
      subjectId: "sub-1",
      requestedAt: now,
    });
    expect(link.manageUrl).toBe("https://account.lax.art/alerts");
    expect((await stores.findBySubject("shop", "sub-1"))?.status).toBe("confirmed");
  });

  it("reuses a person's row, so a release subscriber keeps one set of links", async () => {
    const { stores, links } = setup();
    const first = await links.linkFor({
      email: "ada@example.com",
      subjectId: "sub-1",
      requestedAt: now,
    });
    const second = await links.linkFor({
      email: "ada@example.com",
      subjectId: "sub-1",
      requestedAt: now,
    });
    expect(second.subscriberId).toBe(first.subscriberId);
    expect(stores.subscribersById.size).toBe(1);
  });

  it("closes a request made before the person stopped Shop alerts, or this topic", async () => {
    const { stores, links, stops } = setup();
    const first = await links.linkFor({
      email: "ada@example.com",
      subjectId: null,
      requestedAt: before,
    });
    await stores.stop(first.subscriberId, "link", now);
    stops.set(first.subscriberId, now);
    expect(
      (await links.linkFor({ email: "ada@example.com", subjectId: null, requestedAt: before }))
        .stopped,
    ).toBe(true);

    const other = await links.linkFor({
      email: "bo@example.com",
      subjectId: "sub-2",
      requestedAt: before,
    });
    await stores.setEmail(other.subscriberId, "shop.back_in_stock", false, "person", now);
    stops.set(other.subscriberId, now);
    expect(
      (await links.linkFor({ email: "bo@example.com", subjectId: "sub-2", requestedAt: before }))
        .stopped,
    ).toBe(true);
  });

  it("sends a request made after the stop: pressing Notify me again asks again", async () => {
    const { stores, links, stops } = setup();
    const first = await links.linkFor({
      email: "ada@example.com",
      subjectId: null,
      requestedAt: before,
    });
    await stores.stop(first.subscriberId, "link", now);
    stops.set(first.subscriberId, now);
    const again = await links.linkFor({
      email: "ada@example.com",
      subjectId: null,
      requestedAt: after,
    });
    expect(again.stopped).toBe(false);
    expect(again.subscriberId).toBe(first.subscriberId);
    // Asking again for back in stock does not start release alerts again.
    expect((await stores.findById(first.subscriberId))?.status).toBe("stopped");
  });

  it("never writes again to an address that complained, whenever the request was made", async () => {
    const { stores, links } = setup();
    const first = await links.linkFor({
      email: "ada@example.com",
      subjectId: null,
      requestedAt: before,
    });
    await stores.stop(first.subscriberId, "complaint", now);
    expect(
      (await links.linkFor({ email: "ada@example.com", subjectId: null, requestedAt: after }))
        .stopped,
    ).toBe(true);
  });

  it("finds an existing row's stop token without creating anything", async () => {
    const { stores, codec, links } = setup();
    expect(await links.existingStopToken({ email: "new@example.com", subjectId: null })).toBeNull();
    expect(
      await links.existingStopToken({ email: "new@example.com", subjectId: "sub-9" }),
    ).toBeNull();
    expect(stores.subscribersById.size).toBe(0);

    const made = await links.linkFor({
      email: "ada@example.com",
      subjectId: "sub-1",
      requestedAt: now,
    });
    const token = await links.existingStopToken({ email: " ADA@example.com", subjectId: null });
    expect(token && codec.verify(token, now)?.payload).toMatchObject({
      subscriberId: made.subscriberId,
      topic: "shop.back_in_stock",
    });
    expect(stores.subscribersById.size).toBe(1);
  });
});
