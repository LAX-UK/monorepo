import type {
  IAdminUserActivityReader,
  IAdminUserBidsReader,
  IAdminUserReader,
  IAdminUserRoleManager,
  IAdminUserSuspender,
} from "@auction/persistence";
import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "../lib/errors.js";
import { AdminUserService } from "./admin-user.service.js";

function makeService(bids: IAdminUserBidsReader) {
  const reader = {
    list: vi.fn(),
    getById: vi.fn(),
    getByIds: vi.fn(),
  } as unknown as IAdminUserReader;
  const roles = { setRoleAndStaff: vi.fn() } as unknown as IAdminUserRoleManager;
  const suspender = { suspend: vi.fn(), unsuspend: vi.fn() } as unknown as IAdminUserSuspender;
  const activity = { getRecentSessions: vi.fn() } as unknown as IAdminUserActivityReader;
  return new AdminUserService(reader, roles, suspender, activity, bids);
}

describe("AdminUserService.bidsFor", () => {
  it("allows client_advisor and returns paginated rows", async () => {
    const listForUser = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "bid-1",
          lotId: "lot-1",
          lotTitle: "Test lot",
          saleId: "sale-1",
          saleTitle: "Spring sale",
          amount: "1000.00",
          isWinning: true,
          isAutoBid: false,
          placedVia: "web",
          createdAt: new Date("2026-01-01T12:00:00Z"),
        },
      ],
      total: 1,
    });
    const svc = makeService({ listForUser } as unknown as IAdminUserBidsReader);
    const result = await svc.bidsFor("staff", "client_advisor", "user-1", {
      limit: 25,
      offset: 0,
    });
    expect(result.total).toBe(1);
    expect(listForUser).toHaveBeenCalledWith("user-1", { limit: 25, offset: 0 });
  });

  it("denies operations without bids.read", async () => {
    const svc = makeService({ listForUser: vi.fn() } as unknown as IAdminUserBidsReader);
    let err: unknown;
    try {
      await svc.bidsFor("staff", "operations", "user-1", { limit: 25, offset: 0 });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AuthzError);
    expect((err as AuthzError).status).toBe(403);
  });
});

describe("AdminUserService PII least-privilege", () => {
  it("denies client_advisor from reading KYC sessions", () => {
    const svc = makeService({ listForUser: vi.fn() } as unknown as IAdminUserBidsReader);
    expect(() => svc.kycSessionsFor("staff", "client_advisor", "user-1")).toThrow(AuthzError);
  });

  it("denies client_advisor from reading session activity", () => {
    const svc = makeService({ listForUser: vi.fn() } as unknown as IAdminUserBidsReader);
    expect(() => svc.activityFor("staff", "client_advisor", "user-1", 20)).toThrow(AuthzError);
  });
});
