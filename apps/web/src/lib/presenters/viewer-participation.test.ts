import type { SessionUser } from "@/lib/data/contracts";
import { describe, expect, it } from "vitest";
import { isAdminBuyerBlocked, resolveViewerParticipation } from "./viewer-participation";

function session(partial: Partial<SessionUser> & Pick<SessionUser, "role">): SessionUser {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    ...partial,
  };
}

describe("isAdminBuyerBlocked", () => {
  it("returns false for guests", () => {
    expect(isAdminBuyerBlocked(null)).toBe(false);
  });

  it("returns false for client users", () => {
    expect(isAdminBuyerBlocked(session({ role: "client" }))).toBe(false);
  });

  it("returns true for staff users", () => {
    expect(isAdminBuyerBlocked(session({ role: "staff", staffRole: "catalogue_manager" }))).toBe(
      true,
    );
  });
});

describe("resolveViewerParticipation", () => {
  it("guest can participate as buyer", () => {
    expect(resolveViewerParticipation(null)).toEqual({
      isAuthenticated: false,
      isStaff: false,
      canParticipateAsBuyer: true,
    });
  });

  it("client can participate as buyer", () => {
    expect(resolveViewerParticipation(session({ role: "client" }))).toEqual({
      isAuthenticated: true,
      isStaff: false,
      canParticipateAsBuyer: true,
    });
  });

  it("staff cannot participate as buyer", () => {
    expect(
      resolveViewerParticipation(session({ role: "staff", staffRole: "catalogue_manager" })),
    ).toEqual({
      isAuthenticated: true,
      isStaff: true,
      canParticipateAsBuyer: false,
    });
  });
});
