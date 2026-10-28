import { resolveLegacyDashboardRedirect } from "@/lib/navigation/legacy-dashboard-redirects";
import { describe, expect, it } from "vitest";
import { clientAreaRedirectFor, usesBidAsClient } from "./client-audience";

const client = { role: "client" as const, staffRole: null };
const superAdmin = { role: "staff" as const, staffRole: "super_admin" as const };
const finance = { role: "staff" as const, staffRole: "finance_ops" as const };
const clerk = { role: "staff" as const, staffRole: "auction_manager" as const };
const noStaffRole = { role: "staff" as const, staffRole: null };

describe("usesBidAsClient", () => {
  it("is true for clients and false for every staff account", () => {
    expect(usesBidAsClient(client)).toBe(true);
    for (const staff of [superAdmin, finance, clerk, noStaffRole]) {
      expect(usesBidAsClient(staff)).toBe(false);
    }
  });
});

describe("clientAreaRedirectFor", () => {
  it("lets clients stay", () => {
    expect(clientAreaRedirectFor(client, "/bids")).toBeNull();
  });

  it("sends staff to their admin area from any client page, the submission form included", () => {
    expect(clientAreaRedirectFor(superAdmin, "/bids")).toBe("/admin");
    expect(clientAreaRedirectFor(finance, "/purchases")).toBe("/admin/finance");
    expect(clientAreaRedirectFor(clerk, "/selling/new")).toBe("/admin/sales");
    expect(clientAreaRedirectFor(noStaffRole, "/selling/consignments/s1")).toBe("/admin");
  });

  it("follows an old client address to admin too", () => {
    const newPath = resolveLegacyDashboardRedirect("/dashboard/submissions/new") ?? "";
    expect(newPath).toBe("/selling/new");
    expect(clientAreaRedirectFor(superAdmin, newPath)).toBe("/admin");
  });

  it("lets support staff stay while they view an account as its client", () => {
    expect(clientAreaRedirectFor(superAdmin, "/selling", { viewingAsClient: true })).toBeNull();
    expect(clientAreaRedirectFor(superAdmin, "/selling", { viewingAsClient: false })).toBe(
      "/admin",
    );
  });

  it("never redirects a page to itself", () => {
    expect(clientAreaRedirectFor(superAdmin, "/admin")).toBeNull();
  });
});
