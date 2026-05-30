import {
  clientWorkspaceOverviewMeta,
  clientWorkspacePageMeta,
  isClientBuyingPath,
  isClientSellingPath,
  resolveClientWorkspaceMode,
} from "@/lib/workspace/client-workspace-mode";
import { describe, expect, it } from "vitest";

describe("client workspace meta", () => {
  it("uses Buying/Selling on list pages", () => {
    expect(clientWorkspacePageMeta("buying")).toBe("Buying");
    expect(clientWorkspacePageMeta("selling")).toBe("Selling");
  });

  it("uses Collector home / Seller home on overview", () => {
    expect(clientWorkspaceOverviewMeta("buying")).toBe("Collector home");
    expect(clientWorkspaceOverviewMeta("selling")).toBe("Seller home");
  });
});

describe("resolveClientWorkspaceMode", () => {
  it("forces selling on seller and submission routes", () => {
    expect(resolveClientWorkspaceMode("/dashboard/seller", "buying")).toBe("selling");
    expect(resolveClientWorkspaceMode("/dashboard/seller/in-sale", "buying")).toBe("selling");
    expect(resolveClientWorkspaceMode("/dashboard/submissions/new", "buying")).toBe("selling");
  });

  it("forces buying on collector list routes", () => {
    expect(resolveClientWorkspaceMode("/dashboard/bids", "selling")).toBe("buying");
    expect(resolveClientWorkspaceMode("/dashboard/watchlist", "selling")).toBe("buying");
    expect(resolveClientWorkspaceMode("/dashboard/artist-follow", "selling")).toBe("buying");
  });

  it("keeps cookie on neutral routes", () => {
    expect(resolveClientWorkspaceMode("/dashboard", "selling")).toBe("selling");
    expect(resolveClientWorkspaceMode("/dashboard/notifications", "buying")).toBe("buying");
    expect(resolveClientWorkspaceMode("/dashboard/settings/profile", "selling")).toBe("selling");
  });

  it("classifies path prefixes", () => {
    expect(isClientSellingPath("/dashboard/submissions/abc")).toBe(true);
    expect(isClientBuyingPath("/dashboard/portfolio")).toBe(true);
    expect(isClientBuyingPath("/dashboard")).toBe(false);
  });
});
