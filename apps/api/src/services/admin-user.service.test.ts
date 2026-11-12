import type {
  IAdminUserActivityReader,
  IAdminUserBidsReader,
  IAdminUserReader,
  IAdminUserSuspender,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "../lib/errors.js";
import { AdminUserService } from "./admin-user.service.js";
import type {
  IIdentitySecurityClient,
  IIdentitySignInMethodsClient,
} from "./interfaces/identity-issuer-client.js";

function makeService(
  bids: IAdminUserBidsReader,
  input: {
    reader?: IAdminUserReader;
    identitySecurity?: IIdentitySecurityClient;
    identitySignInMethods?: IIdentitySignInMethodsClient;
  } = {},
) {
  const reader =
    input.reader ??
    ({
      list: vi.fn(),
      getById: vi.fn(),
      getByIds: vi.fn(),
    } as unknown as IAdminUserReader);
  const staffAccess = { setAccess: vi.fn() };
  const suspender = { suspend: vi.fn(), unsuspend: vi.fn() } as unknown as IAdminUserSuspender;
  const activity = { getRecentSessions: vi.fn() } as unknown as IAdminUserActivityReader;
  return new AdminUserService(
    reader,
    staffAccess,
    suspender,
    activity,
    bids,
    undefined,
    undefined,
    input.identitySecurity,
    input.identitySignInMethods,
  );
}

describe("AdminUserService.bidsFor", () => {
  it("allows client_services and returns paginated rows", async () => {
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
    const result = await svc.bidsFor("staff", ["client_services"], "user-1", {
      limit: 25,
      offset: 0,
    });
    expect(result.total).toBe(1);
    expect(listForUser).toHaveBeenCalledWith("user-1", { limit: 25, offset: 0 });
  });

  it("denies a sales manager without bids.read", async () => {
    const svc = makeService({ listForUser: vi.fn() } as unknown as IAdminUserBidsReader);
    let err: unknown;
    try {
      await svc.bidsFor("staff", ["sales_manager"], "user-1", { limit: 25, offset: 0 });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AuthzError);
    expect((err as AuthzError).status).toBe(403);
  });
});

describe("AdminUserService PII least-privilege", () => {
  it("denies client_services from reading KYC sessions", () => {
    const svc = makeService({ listForUser: vi.fn() } as unknown as IAdminUserBidsReader);
    expect(() => svc.kycSessionsFor("staff", ["client_services"], "user-1")).toThrow(AuthzError);
  });

  it("denies client_services from reading session activity", () => {
    const svc = makeService({ listForUser: vi.fn() } as unknown as IAdminUserBidsReader);
    expect(() => svc.activityFor("staff", ["client_services"], "user-1", 20)).toThrow(AuthzError);
  });
});

describe("AdminUserService.getById", () => {
  it("marks live Identity security fields as available", async () => {
    const detail = { id: "user-1", twoFactorEnabled: false, pendingNewEmail: null };
    const service = makeService({ listForUser: vi.fn() } as unknown as IAdminUserBidsReader, {
      reader: {
        list: vi.fn(),
        getById: vi.fn().mockResolvedValue(detail),
        getByIds: vi.fn(),
      } as unknown as IAdminUserReader,
      identitySecurity: {
        readSecurityStatus: vi.fn().mockResolvedValue({
          twoFactorEnabled: true,
          phoneNumber: null,
          phoneNumberVerified: false,
          pendingNewEmail: "new@example.com",
          emailChangeExpiresAt: null,
        }),
      },
    });

    await expect(service.getById("staff", ["client_services"], "user-1")).resolves.toMatchObject({
      securityStatusAvailable: true,
      twoFactorEnabled: true,
      pendingNewEmail: "new@example.com",
    });
  });

  it.each([
    ["returns null", vi.fn().mockResolvedValue(null)],
    ["throws", vi.fn().mockRejectedValue(new Error("Identity unavailable"))],
  ])("keeps local detail when Identity %s", async (_scenario, readSecurityStatus) => {
    const detail = { id: "user-1", twoFactorEnabled: false, pendingNewEmail: null };
    const service = makeService({ listForUser: vi.fn() } as unknown as IAdminUserBidsReader, {
      reader: {
        list: vi.fn(),
        getById: vi.fn().mockResolvedValue(detail),
        getByIds: vi.fn(),
      } as unknown as IAdminUserReader,
      identitySecurity: { readSecurityStatus },
    });

    await expect(service.getById("staff", ["client_services"], "user-1")).resolves.toEqual({
      ...detail,
      securityStatusAvailable: false,
      signInMethodKinds: null,
    });
  });

  it("returns null only when local detail is absent", async () => {
    const readSecurityStatus = vi.fn();
    const service = makeService({ listForUser: vi.fn() } as unknown as IAdminUserBidsReader, {
      reader: {
        list: vi.fn(),
        getById: vi.fn().mockResolvedValue(null),
        getByIds: vi.fn(),
      } as unknown as IAdminUserReader,
      identitySecurity: { readSecurityStatus },
    });

    await expect(service.getById("staff", ["client_services"], "missing")).resolves.toBeNull();
    expect(readSecurityStatus).not.toHaveBeenCalled();
  });

  describe("sign-in method kinds", () => {
    const detail = { id: "user-1", twoFactorEnabled: false, pendingNewEmail: null };
    const security = {
      readSecurityStatus: vi.fn().mockResolvedValue({
        twoFactorEnabled: true,
        phoneNumber: null,
        phoneNumberVerified: false,
        pendingNewEmail: null,
        emailChangeExpiresAt: null,
      }),
    };
    const build = (identitySignInMethods?: IIdentitySignInMethodsClient) =>
      makeService({ listForUser: vi.fn() } as unknown as IAdminUserBidsReader, {
        reader: {
          list: vi.fn(),
          getById: vi.fn().mockResolvedValue(detail),
          getByIds: vi.fn(),
        } as unknown as IAdminUserReader,
        identitySecurity: security,
        ...(identitySignInMethods ? { identitySignInMethods } : {}),
      });

    it("returns the kinds the issuer reports", async () => {
      const kinds = { password: true, google: false, apple: true, passkeys: 2 };
      const readSignInMethodKinds = vi.fn().mockResolvedValue(kinds);
      const result = await build({ readSignInMethodKinds }).getById(
        "staff",
        ["client_services"],
        "user-1",
      );
      expect(result).toMatchObject({ securityStatusAvailable: true, signInMethodKinds: kinds });
      expect(readSignInMethodKinds).toHaveBeenCalledWith("user-1");
    });

    it.each([
      ["returns null", vi.fn().mockResolvedValue(null)],
      ["throws", vi.fn().mockRejectedValue(new Error("Identity unavailable"))],
    ])("says not available, without failing the page, when the issuer %s", async (_s, read) => {
      const result = await build({ readSignInMethodKinds: read }).getById(
        "staff",
        ["client_services"],
        "user-1",
      );
      expect(result).toMatchObject({ securityStatusAvailable: true, signInMethodKinds: null });
    });

    it("says not available when no issuer client is wired", async () => {
      await expect(build().getById("staff", ["client_services"], "user-1")).resolves.toMatchObject({
        signInMethodKinds: null,
      });
    });

    it("is refused for staff without the people directory, before any issuer read", async () => {
      const readSignInMethodKinds = vi.fn();
      await expect(
        build({ readSignInMethodKinds }).getById("staff", ["read_only"], "user-1"),
      ).rejects.toMatchObject({ status: 403 });
      expect(readSignInMethodKinds).not.toHaveBeenCalled();
    });
  });
});
