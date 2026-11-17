import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const reader = vi.hoisted(() => ({ getAdminDeliveriesWaitingCount: vi.fn() }));
vi.mock("@/lib/data/http/admin-deliveries.reader", () => reader);

import { withDeliveriesNavCount } from "./deliveries-nav-count.server";

beforeEach(() => reader.getAdminDeliveriesWaitingCount.mockReset());

describe("withDeliveriesNavCount", () => {
  it.each(["fulfilment", "administrator", "read_only"] as const)(
    "counts buyers waiting for a price for %s",
    async (role) => {
      reader.getAdminDeliveriesWaitingCount.mockResolvedValue(3);
      const counts = await withDeliveriesNavCount(EMPTY_ADMIN_NAV_COUNTS, "staff", [role]);
      expect(counts.deliveriesWaiting).toBe(3);
    },
  );

  it("does not ask the API of someone who cannot open the page", async () => {
    const counts = await withDeliveriesNavCount(
      { ...EMPTY_ADMIN_NAV_COUNTS, deliveriesWaiting: 5 },
      "staff",
      ["finance"],
    );
    expect(counts.deliveriesWaiting).toBe(0);
    expect(reader.getAdminDeliveriesWaitingCount).not.toHaveBeenCalled();
  });

  it("shows no count when the API does not answer", async () => {
    reader.getAdminDeliveriesWaitingCount.mockRejectedValueOnce(new Error("down"));
    const counts = await withDeliveriesNavCount(EMPTY_ADMIN_NAV_COUNTS, "staff", ["fulfilment"]);
    expect(counts.deliveriesWaiting).toBe(0);
  });
});
