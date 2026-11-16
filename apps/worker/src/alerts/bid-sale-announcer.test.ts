import { describe, expect, it, vi } from "vitest";
import { BidSaleAnnouncer } from "./bid-sale-announcer.js";
import { londonDayLabel, saleNotice, saleSnapshot } from "./sale-snapshot.js";

const sale = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Modern British and Irish Art",
  startTime: new Date("2026-11-18T10:00:00Z"),
  endTime: new Date("2026-11-26T18:00:00Z"),
  timeZone: "Europe/London",
  status: "scheduled" as const,
  deliveryMode: "online" as const,
  isTest: false,
  cover: null as { key: string; alt: string } | null,
};

function setup(
  over: {
    sale?: typeof sale | null;
    announced?: boolean;
    first?: boolean;
    sendNotices?: boolean;
    coverUrl?: (key: string) => Promise<string | null>;
  } = {},
) {
  const announce = vi.fn().mockResolvedValue({
    first: over.first ?? true,
    announced: over.announced ?? true,
    matches: 2,
  });
  const notifySubscribers = vi.fn().mockResolvedValue(1);
  const announcer = new BidSaleAnnouncer({
    sales: { find: vi.fn().mockResolvedValue(over.sale === undefined ? sale : over.sale) },
    matches: { announce },
    notices: { notifySubscribers },
    sendNotices: over.sendNotices ?? true,
    ...(over.coverUrl ? { coverUrl: over.coverUrl } : {}),
  });
  return { announcer, announce, notifySubscribers };
}

describe("BidSaleAnnouncer", () => {
  it("puts the sale's cover and its alt text in the snapshot", async () => {
    const { announcer, announce } = setup({
      sale: { ...sale, cover: { key: "sales/spring.jpg", alt: "A bronze horse on a plinth" } },
      coverUrl: async (key) => `https://media.lax.bid/${key.replace(/\.jpg$/, "")}.email-640.jpg`,
    });
    await announcer.handle({ saleId: sale.id, announce: true, lotCount: 3 });
    expect(announce.mock.calls[0]?.[0].snapshot).toMatchObject({
      imageUrl: "https://media.lax.bid/sales/spring.email-640.jpg",
      imageAlt: "A bronze horse on a plinth",
    });
  });

  it("leaves the picture out when the sale has none or its address cannot be placed", async () => {
    const none = setup({ coverUrl: async () => "https://x" });
    await none.announcer.handle({ saleId: sale.id, announce: true, lotCount: 3 });
    expect(none.announce.mock.calls[0]?.[0].snapshot).not.toHaveProperty("imageUrl");
    const unplaced = setup({
      sale: { ...sale, cover: { key: "k", alt: "a" } },
      coverUrl: async () => null,
    });
    await unplaced.announcer.handle({ saleId: sale.id, announce: true, lotCount: 3 });
    expect(unplaced.announce.mock.calls[0]?.[0].snapshot).not.toHaveProperty("imageUrl");
  });

  it("never announces a test sale: no match is recorded and nobody is notified", async () => {
    const { announcer, announce, notifySubscribers } = setup({ sale: { ...sale, isTest: true } });
    const outcome = await announcer.handle({ saleId: sale.id, announce: true, lotCount: 3 });
    expect(outcome).toBe("skipped_test_sale");
    expect(announce).not.toHaveBeenCalled();
    expect(notifySubscribers).not.toHaveBeenCalled();
  });

  it("records the sale for subscribers and tells signed-in clients in the app", async () => {
    const { announcer, announce, notifySubscribers } = setup();
    const outcome = await announcer.handle({ saleId: sale.id, announce: true, lotCount: 214 });
    expect(outcome).toBe("announced");
    expect(announce).toHaveBeenCalledWith({
      topic: "bid.new_sales",
      itemKey: `sale:${sale.id}`,
      announce: true,
      snapshot: {
        title: "Modern British and Irish Art",
        subtitle: "Online",
        moments: [
          { label: "Opens", at: "2026-11-18T10:00:00.000Z", zone: "Europe/London" },
          { label: "Closes", at: "2026-11-26T18:00:00.000Z", zone: "Europe/London" },
        ],
        detail: "214 lots",
        path: `/sales/${sale.id}`,
      },
    });
    expect(notifySubscribers).toHaveBeenCalledWith({
      saleId: sale.id,
      title: "New sale: Modern British and Irish Art",
      message: "Opens Wed 18 Nov · 214 lots",
    });
  });

  it("leaves a sale that is a draft again unclaimed, so it can be announced when published for good", async () => {
    const { announcer, announce } = setup({ sale: { ...sale, status: "draft" as never } });
    expect(await announcer.handle({ saleId: sale.id, announce: true, lotCount: 1 })).toBe(
      "skipped_not_published",
    );
    expect(announce).not.toHaveBeenCalled();
    const gone = setup({ sale: null });
    expect(await gone.announcer.handle({ saleId: sale.id, announce: true, lotCount: 1 })).toBe(
      "skipped_not_published",
    );
  });

  it("tells nobody when staff untick Announce, nor when the sale was announced before", async () => {
    const quiet = setup({ announced: false, first: true });
    expect(await quiet.announcer.handle({ saleId: sale.id, announce: false, lotCount: 3 })).toBe(
      "quiet",
    );
    expect(quiet.notifySubscribers).not.toHaveBeenCalled();
    const again = setup({ announced: false, first: false });
    expect(await again.announcer.handle({ saleId: sale.id, announce: true, lotCount: 3 })).toBe(
      "already_announced",
    );
    expect(again.notifySubscribers).not.toHaveBeenCalled();
  });

  it("records matches but shows nothing in the app during a dry run", async () => {
    const { announcer, announce, notifySubscribers } = setup({ sendNotices: false });
    await announcer.handle({ saleId: sale.id, announce: true, lotCount: 1 });
    expect(announce).toHaveBeenCalled();
    expect(notifySubscribers).not.toHaveBeenCalled();
  });
});

describe("sale snapshot", () => {
  it("names the London day, which is not always the UTC day", () => {
    expect(londonDayLabel(new Date("2026-06-30T23:30:00Z"))).toBe("Wed 1 Jul");
  });

  it("omits the lot count when unknown and says one lot in the singular", () => {
    expect(saleSnapshot(sale, null).detail).toBeUndefined();
    expect(saleSnapshot(sale, 1).detail).toBe("1 lot");
    expect(saleNotice(sale, null).message).toBe("Opens Wed 18 Nov");
  });
});
