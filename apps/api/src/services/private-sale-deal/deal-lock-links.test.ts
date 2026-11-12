import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { lockMessage } from "@auction/artwork-register-contracts";
import { describe, expect, it } from "vitest";
import { DealLockLinks } from "./deal-lock-links.js";

type LinkedEntry = Pick<ArtworkRegisterEntry, "id" | "zohoProductId" | "offer">;

const entry = (offer: LinkedEntry["offer"]): LinkedEntry => ({
  id: "reg-1",
  zohoProductId: "zp-9",
  offer,
});
const deals = {
  findReferencesByIds: async (ids: readonly string[]) =>
    new Map(ids.map((id) => [id, "PS-0042"] as const)),
};
const CONFIG = {
  laxAdminOrigin: "https://admin.lax.example/",
  zohoRecordUrlTemplate: "https://crm.example/{module}/{recordId}",
};

async function hrefOf(
  reason: Parameters<typeof lockMessage>[0],
  offer: LinkedEntry["offer"],
  config = CONFIG,
) {
  const [result] = await new DealLockLinks(config, deals).attach([
    { entry: entry(offer), lock: lockMessage(reason) },
  ]);
  return result?.link?.href;
}

describe("DealLockLinks", () => {
  it("opens a lot in Bid admin by path, with no host written in code", async () => {
    expect(
      await hrefOf("in_bid_sale", { state: "bid_sale", ref: { kind: "bid_lot", id: "lot-7" } }),
    ).toBe("/admin/lots/lot-7");
  });

  it("opens another deal by its reference", async () => {
    expect(
      await hrefOf("in_private_sale", {
        state: "private_sale",
        ref: { kind: "private_sale", id: "d-1" },
      }),
    ).toBe("/admin/private-sales/PS-0042");
  });

  it("sends lax.art and sold places to the record page in LAX Admin, from its configured origin", async () => {
    const held = { state: "lax_art", ref: { kind: "shop_artwork", id: "x" } } as const;
    expect(await hrefOf("live_on_lax_art", held)).toBe("https://admin.lax.example/from-zoho/reg-1");
  });

  it("fills the CRM template for the Zoho record", async () => {
    expect(await hrefOf("reserved_in_zoho", { state: "held", ref: null })).toBe(
      "https://crm.example/Products/zp-9",
    );
  });

  it("leaves the link without an address when the product's address is not configured", async () => {
    expect(
      await hrefOf("live_on_lax_art", { state: "lax_art", ref: null }, {} as never),
    ).toBeNull();
    expect(await hrefOf("reserved_in_zoho", { state: "held", ref: null }, {} as never)).toBeNull();
  });

  it("keeps a message that has no link as it is", async () => {
    const [result] = await new DealLockLinks(CONFIG, deals).attach([
      { entry: entry({ state: "held", ref: null }), lock: lockMessage("print") },
    ]);
    expect(result?.link).toBeNull();
  });

  it("gives the record page address for an artwork, or none without LAX Admin's address", () => {
    expect(new DealLockLinks(CONFIG, deals).recordHref("a b")).toBe(
      "https://admin.lax.example/from-zoho/a%20b",
    );
    expect(new DealLockLinks({}, deals).recordHref("a")).toBeNull();
  });
});
