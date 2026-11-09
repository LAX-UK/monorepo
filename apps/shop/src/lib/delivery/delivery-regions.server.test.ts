import * as Sentry from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ read: (async () => ({})) as () => Promise<unknown> }));
vi.mock("@/lib/shop-api.server", () => ({ fetchPublicDeliveryRegions: () => api.read() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const { readDeliveryRegions } = await import("./delivery-regions.server");

afterEach(() => vi.restoreAllMocks());

describe("readDeliveryRegions", () => {
  it("returns the regions the API gives", async () => {
    const data = { regions: [], notDeliveredTo: [] };
    api.read = async () => data;
    expect(await readDeliveryRegions()).toBe(data);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("logs and reports a failed read, and returns null instead of throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const failure = new Error("down");
    api.read = async () => {
      throw failure;
    };
    expect(await readDeliveryRegions()).toBeNull();
    expect(warn).toHaveBeenCalledWith("[shop] delivery regions read failed (server-side)", {
      reason: "Error",
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(failure, {
      tags: { area: "delivery-regions" },
    });
  });
});
