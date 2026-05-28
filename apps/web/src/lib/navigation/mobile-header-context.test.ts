import {
  firstNameFromDisplayName,
  formatActingContextLine,
  isDashboardOverviewRoute,
  resolveMobileHeaderTitleModel,
  shouldUseCompactLegalEntitySwitcher,
} from "@/lib/navigation/mobile-header-context";
import type { LegalEntitySummary } from "@auction/types";
import { describe, expect, it } from "vitest";

const privateCollector: LegalEntitySummary = {
  id: "le-1",
  displayName: "Jane Doe",
  kind: "individual",
  subkind: "private_collector",
  status: "approved",
  role: "owner",
  isPrimaryAdmin: true,
};

const galleryOrg: LegalEntitySummary = {
  id: "org-1",
  displayName: "Acme Gallery",
  kind: "organisation",
  subkind: "gallery",
  status: "approved",
  role: "admin",
  isPrimaryAdmin: false,
};

describe("mobile-header-context", () => {
  it("detects overview routes per workspace", () => {
    expect(isDashboardOverviewRoute("/dashboard", "buying")).toBe(true);
    expect(isDashboardOverviewRoute("/dashboard/seller", "selling")).toBe(true);
    expect(isDashboardOverviewRoute("/dashboard/seller", "buying")).toBe(false);
    expect(isDashboardOverviewRoute("/dashboard/watchlist", "buying")).toBe(false);
  });

  it("formats acting context lines", () => {
    expect(formatActingContextLine(privateCollector)).toBe("Private collector");
    expect(formatActingContextLine(galleryOrg)).toBe("Gallery · Admin");
  });

  it("returns identity model on buying overview", () => {
    const model = resolveMobileHeaderTitleModel([{ label: "Dashboard" }], {
      pathname: "/dashboard",
      workspace: "buying",
      acting: privateCollector,
      actingContext: { kind: "self" },
      userDisplayName: "Jane Doe",
    });

    expect(model.title).toBe("Welcome, Jane");
    expect(model.contextLine).toBe("Jane Doe · Private collector");
    expect(model.variant).toBe("identity");
  });

  it("adds org eyebrow on nested routes when acting as organisation", () => {
    const model = resolveMobileHeaderTitleModel(
      [{ label: "Dashboard", href: "/dashboard" }, { label: "Watchlist" }],
      {
        pathname: "/dashboard/watchlist",
        workspace: "buying",
        acting: galleryOrg,
        actingContext: { kind: "organisation", orgId: "org-1", orgName: "Acme Gallery" },
      },
    );

    expect(model.title).toBe("Watchlist");
    expect(model.eyebrow).toBe("Acme Gallery");
    expect(model.orgActing).toBe(true);
  });

  it("uses compact switcher on nested routes only", () => {
    expect(shouldUseCompactLegalEntitySwitcher("/dashboard")).toBe(false);
    expect(shouldUseCompactLegalEntitySwitcher("/dashboard/seller")).toBe(false);
    expect(shouldUseCompactLegalEntitySwitcher("/dashboard/watchlist")).toBe(true);
  });

  it("extracts first name safely", () => {
    expect(firstNameFromDisplayName("Jane Doe")).toBe("Jane");
    expect(firstNameFromDisplayName("")).toBe("there");
  });
});
