import { type DigestMessage, assembleDigest } from "@auction/alerts";
import { describe, expect, it } from "vitest";
import { confirmationEmail, digestEmail } from "./alert-emails.js";
import { emailProductFor } from "./email-product.js";
import { renderEmail } from "./render.js";

const when = new Date("2026-11-04T08:00:00Z");

function artDigest(over: Partial<DigestMessage> = {}): DigestMessage {
  const vm = assembleDigest([
    {
      id: "m1",
      subscriberId: "s1",
      topic: "art.followed_artists",
      itemKey: "artwork:a1",
      groupKey: "artist-1",
      snapshot: {
        title: "Harbour light",
        subtitle: "Oil on canvas",
        path: "/artworks/harbour-light",
        groupLabel: "Iris Calder",
      },
      matchedAt: when,
    },
  ]);
  if (!vm) throw new Error("no digest");
  return {
    product: "art",
    to: "collector@example.com",
    subscriberId: "s1",
    localDate: "2026-11-04",
    idempotencyKey: "alert-digest:art:s1:2026-11-04",
    vm,
    activeTopics: ["art.followed_artists"],
    siteUrl: (p) => `https://lax.art${p}`,
    stopUrl: "https://lax.art/alerts/unsubscribe?token=S",
    oneClickUrl: "https://lax.art/alerts/unsubscribe?token=S",
    manageUrl: null,
    audience: "account",
    ...over,
  };
}

describe("alert email builders", () => {
  it("builds the Shop confirmation in Shop's words, keyed by subscriber and request", () => {
    const email = confirmationEmail({
      product: "shop",
      to: "a@example.com",
      subscriberId: "s9",
      requestedAtMs: 42,
      confirmUrl: "https://shop.example/release-alerts/confirm?token=C",
      stopUrl: "https://shop.example/release-alerts/unsubscribe?token=S",
      oneClickUrl: "https://shop.example/release-alerts/unsubscribe?token=S",
      expirationHours: 48,
    });
    expect(email.template).toBe("alert-confirm");
    expect(email.idempotencyKey).toBe("alert-confirm:s9:42");
    expect(email.vars).toMatchObject({
      product: "shop",
      subject: "Confirm your LAX Shop release alerts",
    });
    expect(email.stream).toBeUndefined();
  });

  it("builds the lax.art digest on the broadcast stream under the ledger's key", () => {
    const email = digestEmail(artDigest());
    expect(email).toMatchObject({
      template: "alert-digest",
      stream: "broadcast",
      idempotencyKey: "alert-digest:art:s1:2026-11-04",
    });
    expect(email.vars.subject).toBe("New work: Harbour light");
    expect(email.vars.reason).toContain("lax.art");
    expect(email.vars.reason).toContain("artists you follow");
    expect(email.vars.groups[0]?.subgroups[0]?.items[0]?.url).toBe(
      "https://lax.art/artworks/harbour-light",
    );
  });

  it("names the product and its company, so the From name and footer are lax.art's", async () => {
    const email = digestEmail(artDigest());
    expect(emailProductFor("alert-digest", email.vars)).toBe("art");
    const rendered = await renderEmail("alert-digest", email.vars);
    expect(rendered.text).toContain("London Art Exchange Ltd");
    expect(rendered.text).not.toContain("London Auction Xchange");
  });

  it("names the Shop company on a Shop digest", async () => {
    const vm = assembleDigest([
      {
        id: "m2",
        subscriberId: "s2",
        topic: "shop.releases",
        itemKey: "artwork:e1",
        groupKey: null,
        snapshot: { title: "Harbour light, edition", path: "/artworks/harbour-light-edition" },
        matchedAt: when,
      },
    ]);
    if (!vm) throw new Error("no digest");
    const email = digestEmail(
      artDigest({
        product: "shop",
        vm,
        activeTopics: ["shop.releases"],
        siteUrl: (p) => `https://shop.example${p}`,
      }),
    );
    expect(emailProductFor("alert-digest", email.vars)).toBe("shop");
    const rendered = await renderEmail("alert-digest", email.vars);
    expect(rendered.text).toContain("London Art Exchange Ltd");
    expect(email.vars.reason).toContain("LAX Shop");
  });
});
