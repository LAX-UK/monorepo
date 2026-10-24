import { describe, expect, it } from "vitest";
import {
  NO_SELLER_ACCESS,
  opensSellerTool,
  probeFromListStatus,
  resolveShopSellerAccess,
  showsSellerTool,
} from "./shop-seller-access";

const base = {
  ownershipEnabled: true,
  payoutsEnabled: true,
  saleAuthority: "no",
  payouts: "no",
  sales: "no",
  artist: "no",
} as const;

describe("probeFromListStatus", () => {
  it("reads rows as yes, empty or switched off as no, and failures as unknown", () => {
    expect(probeFromListStatus("ok")).toBe("yes");
    expect(probeFromListStatus("empty")).toBe("no");
    expect(probeFromListStatus("commerce_unavailable")).toBe("no");
    expect(probeFromListStatus("failed")).toBe("unknown");
    expect(probeFromListStatus("unauthorized")).toBe("unknown");
  });
});

describe("resolveShopSellerAccess", () => {
  it("treats a viewer with no seller records as a plain buyer", () => {
    expect(resolveShopSellerAccess(base)).toEqual(NO_SELLER_ACCESS);
  });

  it("makes a seller with sale authority a payee as well", () => {
    expect(resolveShopSellerAccess({ ...base, saleAuthority: "yes" })).toEqual({
      seller: "yes",
      payee: "yes",
      artist: "no",
    });
  });

  it("makes anyone with payouts or sales on record a payee", () => {
    expect(resolveShopSellerAccess({ ...base, payouts: "yes" }).payee).toBe("yes");
    expect(resolveShopSellerAccess({ ...base, sales: "yes" }).payee).toBe("yes");
  });

  it("follows the environment switches before the viewer's records", () => {
    const off = resolveShopSellerAccess({
      ...base,
      ownershipEnabled: false,
      payoutsEnabled: false,
      saleAuthority: "yes",
      payouts: "yes",
    });
    expect(off.seller).toBe("no");
    expect(off.payee).toBe("no");
  });

  it("keeps a failed lookup unknown rather than no", () => {
    expect(resolveShopSellerAccess({ ...base, payouts: "unknown" }).payee).toBe("unknown");
  });
});

describe("seller tool visibility", () => {
  it("shows a tool only on yes, and turns the viewer away only on no", () => {
    const unknown = { seller: "unknown", payee: "unknown", artist: "unknown" } as const;
    expect(showsSellerTool(unknown, "payouts")).toBe(false);
    expect(opensSellerTool(unknown, "payouts")).toBe(true);
    expect(opensSellerTool(NO_SELLER_ACCESS, "payouts")).toBe(false);
    expect(opensSellerTool(NO_SELLER_ACCESS, "sale-limits")).toBe(false);
    expect(opensSellerTool(NO_SELLER_ACCESS, "artworks")).toBe(false);
    expect(showsSellerTool({ ...NO_SELLER_ACCESS, artist: "yes" }, "artist-sales")).toBe(true);
  });
});
