import { AlertLinkCodec } from "@auction/alerts";
import { MemoryAlertStores } from "@auction/alerts/testing";
import { describe, expect, it } from "vitest";
import { createBackInStockLinks } from "./back-in-stock-links.js";
import { shopAlertUrls } from "./shop-alert-urls.js";

const key = { id: "k1", secret: "links-test-secret-0123456789abcdef" }; // gitleaks:allow
const now = new Date("2026-11-16T10:00:00Z");

function setup() {
  const stores = new MemoryAlertStores();
  const codec = new AlertLinkCodec({ signing: key, accepted: [key] });
  const links = createBackInStockLinks({
    subscribers: stores,
    topics: stores,
    codec,
    urls: shopAlertUrls("https://shop.lax.art", "https://account.lax.art/alerts"),
    clock: { now: () => now },
  });
  return { stores, codec, links };
}

describe("back in stock engine links", () => {
  it("gives a guest a signed stop link on the shared stop address, with no manage link", async () => {
    const { stores, codec, links } = setup();
    const link = await links.linkFor({ email: " Ada@Example.com ", subjectId: null });
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
    const link = await links.linkFor({ email: "ada@example.com", subjectId: "sub-1" });
    expect(link.manageUrl).toBe("https://account.lax.art/alerts");
    expect((await stores.findBySubject("shop", "sub-1"))?.status).toBe("confirmed");
  });

  it("reuses a person's row, so a release subscriber keeps one set of links", async () => {
    const { stores, links } = setup();
    const first = await links.linkFor({ email: "ada@example.com", subjectId: "sub-1" });
    const second = await links.linkFor({ email: "ada@example.com", subjectId: "sub-1" });
    expect(second.subscriberId).toBe(first.subscriberId);
    expect(stores.subscribersById.size).toBe(1);
  });

  it("reports a person who stopped Shop alerts, or this topic, as stopped", async () => {
    const { stores, links } = setup();
    const first = await links.linkFor({ email: "ada@example.com", subjectId: null });
    await stores.stop(first.subscriberId, "link", now);
    expect((await links.linkFor({ email: "ada@example.com", subjectId: null })).stopped).toBe(true);

    const other = await links.linkFor({ email: "bo@example.com", subjectId: "sub-2" });
    await stores.setEmail(other.subscriberId, "shop.back_in_stock", false, "person", now);
    expect((await links.linkFor({ email: "bo@example.com", subjectId: "sub-2" })).stopped).toBe(
      true,
    );
  });
});
