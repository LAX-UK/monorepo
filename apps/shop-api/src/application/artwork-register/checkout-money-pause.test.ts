import type { RegisterLink } from "@auction/artwork-register-contracts";
import { describe, expect, it, vi } from "vitest";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { assertCheckoutNotPaused } from "./checkout-money-pause.js";

const guard = (paused: string[], productIds: string[] = ["z-1", "z-2"]) => ({
  pause: {
    isPaused: vi.fn(
      async (link: RegisterLink) => "zohoProductId" in link && paused.includes(link.zohoProductId),
    ),
  },
  zohoProductIdsFor: vi.fn(async (_artworkIds: readonly string[]) => productIds),
});

describe("assertCheckoutNotPaused", () => {
  it("lets a basket through when no artwork in it is paused", async () => {
    await expect(assertCheckoutNotPaused(guard([]), ["a-1", "a-2"])).resolves.toBeUndefined();
  });

  it("refuses with the calm buyer message when one artwork is paused", async () => {
    const error = await assertCheckoutNotPaused(guard(["z-2"]), ["a-1", "a-2"]).catch((e) => e);
    expect(error).toBeInstanceOf(ShopApiError);
    expect(error.message).toBe("This artwork is no longer available to buy online.");
    expect(error.statusCode).toBe(409);
  });

  it("asks nothing for an empty basket", async () => {
    const g = guard(["z-1"]);
    await expect(assertCheckoutNotPaused(g, [])).resolves.toBeUndefined();
    expect(g.zohoProductIdsFor).not.toHaveBeenCalled();
  });

  it("does not govern artworks with no Zoho Product", async () => {
    await expect(assertCheckoutNotPaused(guard(["z-1"], []), ["a-1"])).resolves.toBeUndefined();
  });
});
