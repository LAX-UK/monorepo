import { resolveMobileHeaderTitleModel } from "@/lib/navigation/mobile-header-context";
import { describe, expect, it } from "vitest";

describe("resolveMobileHeaderTitleModel", () => {
  it("titles the seller overview like any other page, with no welcome block", () => {
    const model = resolveMobileHeaderTitleModel(
      [{ label: "Selling", href: "/dashboard/seller" }, { label: "Overview" }],
      { actingContext: { kind: "self" }, workspace: "selling" },
    );
    expect(model.title).toBe("Overview");
    expect(model).not.toHaveProperty("contextLine");
  });

  it("adds the organisation as an eyebrow when buying as one", () => {
    const model = resolveMobileHeaderTitleModel(
      [{ label: "Dashboard", href: "/dashboard" }, { label: "Watchlist" }],
      {
        actingContext: { kind: "organisation", orgId: "org-1", orgName: "Acme Gallery" },
        workspace: "buying",
      },
    );
    expect(model.title).toBe("Watchlist");
    expect(model.eyebrow).toBe("Acme Gallery");
    expect(model.orgActing).toBe(true);
  });

  it("leaves the eyebrow off in Selling, where the switcher shows the account", () => {
    const model = resolveMobileHeaderTitleModel(
      [{ label: "Selling", href: "/dashboard/seller" }, { label: "Works" }],
      {
        actingContext: {
          kind: "organisation",
          orgId: "org-1",
          orgName: "The Northbank Contemporary Gallery Ltd",
        },
        workspace: "selling",
      },
    );
    expect(model.title).toBe("Works");
    expect(model.eyebrow).toBeUndefined();
    expect(model.orgActing).toBeUndefined();
  });
});
