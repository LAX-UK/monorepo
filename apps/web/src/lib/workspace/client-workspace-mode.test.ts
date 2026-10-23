import {
  clientWorkspaceHomePath,
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
    expect(resolveClientWorkspaceMode("/dashboard/seller/consignments", "buying")).toBe("selling");
    expect(resolveClientWorkspaceMode("/dashboard/submissions/new", "buying")).toBe("selling");
  });

  it("keeps every Selling page in selling mode, so the mode label and nav never disagree", () => {
    const sellingPages = [
      "/dashboard/seller/consignments",
      "/dashboard/seller/works",
      "/dashboard/seller/payouts",
      "/dashboard/seller/connect",
      "/dashboard/seller/artist",
      "/dashboard/seller/organisations/org-1",
      "/dashboard/seller/organisations/org-1/members",
      "/dashboard/seller/organisations/org-1/documents",
      "/dashboard/seller/organisations/org-1/security",
      "/dashboard/submissions/new",
      "/dashboard/submissions/abc",
    ];
    for (const path of sellingPages) {
      expect(resolveClientWorkspaceMode(path, "buying")).toBe("selling");
      expect(resolveClientWorkspaceMode(path, "selling")).toBe("selling");
    }
  });

  it("never treats a Selling page as a buying page", () => {
    expect(isClientBuyingPath("/dashboard/seller/works")).toBe(false);
    expect(isClientBuyingPath("/dashboard/seller/organisations/org-1")).toBe(false);
  });

  it("forces buying on collector list routes", () => {
    expect(resolveClientWorkspaceMode("/dashboard/bids", "selling")).toBe("buying");
    expect(resolveClientWorkspaceMode("/dashboard/watchlist", "selling")).toBe("buying");
    expect(resolveClientWorkspaceMode("/dashboard/purchases", "selling")).toBe("buying");
  });

  it("keeps cookie on neutral routes", () => {
    expect(resolveClientWorkspaceMode("/dashboard", "selling")).toBe("selling");
    expect(resolveClientWorkspaceMode("/dashboard/notifications", "buying")).toBe("buying");
    expect(resolveClientWorkspaceMode("/dashboard/settings/profile", "selling")).toBe("selling");
  });

  it("classifies path prefixes", () => {
    expect(isClientSellingPath("/dashboard/submissions/abc")).toBe(true);
    expect(isClientBuyingPath("/dashboard/purchases")).toBe(true);
    expect(isClientBuyingPath("/dashboard")).toBe(false);
  });
});

describe("clientWorkspaceHomePath", () => {
  it("opens My bids when buying and the seller overview when selling", () => {
    expect(clientWorkspaceHomePath("buying")).toBe("/dashboard/bids");
    expect(clientWorkspaceHomePath("selling")).toBe("/dashboard/seller");
  });
});
