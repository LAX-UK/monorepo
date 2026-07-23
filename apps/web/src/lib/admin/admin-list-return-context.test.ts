import { describe, expect, it } from "vitest";
import {
  buildAdminListReturnTarget,
  parseAdminListReturnTarget,
} from "./admin-list-return-context";

describe("admin-list-return-context", () => {
  it("builds and parses an allowed return target", () => {
    const target = buildAdminListReturnTarget("/admin/compliance/source-of-funds", {
      status: "pending",
      offset: "25",
    });
    expect(parseAdminListReturnTarget(target, "/admin/compliance/source-of-funds")).toBe(target);
  });

  it("rejects external or disallowed paths", () => {
    expect(parseAdminListReturnTarget("https://evil.test/admin", "/fallback")).toBe("/fallback");
    expect(parseAdminListReturnTarget("/admin/payments", "/fallback")).toBe("/fallback");
  });

  it("allows people list return targets", () => {
    const clients = buildAdminListReturnTarget("/admin/clients", { q: "alice", client: "u1" });
    expect(parseAdminListReturnTarget(clients, "/admin/clients")).toBe(clients);

    const staff = buildAdminListReturnTarget("/admin/staff", { staff: "s1" });
    expect(parseAdminListReturnTarget(staff, "/admin/staff")).toBe(staff);

    const entities = buildAdminListReturnTarget("/admin/legal-entities", { entity: "e1" });
    expect(parseAdminListReturnTarget(entities, "/admin/legal-entities")).toBe(entities);

    const onboarding = buildAdminListReturnTarget("/admin/onboarding-issues", {
      tab: "kyc",
      item: "item-1",
    });
    expect(parseAdminListReturnTarget(onboarding, "/admin/onboarding-issues")).toBe(onboarding);

    const invitations = buildAdminListReturnTarget("/admin/invitations", {
      invitation: "inv-1",
    });
    expect(parseAdminListReturnTarget(invitations, "/admin/invitations")).toBe(invitations);
  });
});
