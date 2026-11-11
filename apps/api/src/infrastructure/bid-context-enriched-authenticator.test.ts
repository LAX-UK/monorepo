import { describe, expect, it, vi } from "vitest";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { IBidUserContextLoader } from "../services/interfaces/bid-user-context.js";
import {
  BidContextEnrichedAuthenticator,
  IdentityPrincipalAuthenticator,
} from "./bid-context-enriched-authenticator.js";

describe("BidContextEnrichedAuthenticator", () => {
  it("loads bid authorization from local profile, not identity token", async () => {
    const identity: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "user_1",
        role: "client",
        staffRoles: [],
        scopes: [],
      }),
    };
    const bidContext: IBidUserContextLoader = {
      loadContext: vi.fn().mockResolvedValue({
        role: "staff",
        staffRoles: ["sales_manager", "client_services"],
        suspendedAt: null,
        identityDisabledAt: null,
        mergedIntoSubjectId: null,
      }),
    };

    const auth = new BidContextEnrichedAuthenticator(
      new IdentityPrincipalAuthenticator(identity),
      bidContext,
    );

    const user = await auth.getSessionUser(new Headers());
    expect(user).toEqual({
      id: "user_1",
      scopes: [],
      role: "staff",
      staffRoles: ["sales_manager", "client_services"],
    });
  });

  it.each([
    {
      label: "disabled",
      identityDisabledAt: new Date("2026-08-01T00:00:00Z"),
      mergedIntoSubjectId: null,
    },
    {
      label: "retired",
      identityDisabledAt: new Date("2026-08-01T00:00:00Z"),
      mergedIntoSubjectId: "canonical-user",
    },
  ])("rejects $label Identity subjects after cookie or JWT authentication", async (state) => {
    const identity: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "retired-user",
        role: "client",
        staffRoles: [],
        scopes: [],
      }),
    };
    const bidContext: IBidUserContextLoader = {
      loadContext: vi.fn().mockResolvedValue({
        role: "client",
        staffRole: null,
        suspendedAt: null,
        identityDisabledAt: state.identityDisabledAt,
        mergedIntoSubjectId: state.mergedIntoSubjectId,
      }),
    };
    const auth = new BidContextEnrichedAuthenticator(
      new IdentityPrincipalAuthenticator(identity),
      bidContext,
    );

    await expect(
      auth.getSessionUser(
        new Headers({ authorization: "Bearer already-issued-jwt", cookie: "session=active" }),
      ),
    ).resolves.toBeNull();
  });

  describe("within one request", () => {
    const profile = {
      role: "staff" as const,
      staffRoles: ["sales_manager"] as const,
      suspendedAt: null,
      identityDisabledAt: null,
      mergedIntoSubjectId: null,
    };
    const build = (loadContext: IBidUserContextLoader["loadContext"]) => {
      const identity: IAuthenticator = {
        getSessionUser: vi.fn().mockResolvedValue({ id: "user_1", scopes: [] }),
      };
      const auth = new BidContextEnrichedAuthenticator(
        new IdentityPrincipalAuthenticator(identity),
        {
          loadContext,
        },
      );
      return { auth, identity };
    };

    it("looks the session up once for the same request headers", async () => {
      const loadContext = vi.fn().mockResolvedValue(profile);
      const { auth, identity } = build(loadContext);
      const headers = new Headers();
      const [a, b] = await Promise.all([
        auth.getSessionUser(headers),
        auth.getSessionUser(headers),
      ]);
      expect(a).toBe(b);
      expect(identity.getSessionUser).toHaveBeenCalledTimes(1);
      expect(loadContext).toHaveBeenCalledTimes(1);
    });

    it("does not share an answer between requests", async () => {
      const loadContext = vi.fn().mockResolvedValue(profile);
      const { auth } = build(loadContext);
      await auth.getSessionUser(new Headers());
      await auth.getSessionUser(new Headers());
      expect(loadContext).toHaveBeenCalledTimes(2);
    });

    it("does not remember a failed lookup", async () => {
      const loadContext = vi
        .fn()
        .mockRejectedValueOnce(new Error("db down"))
        .mockResolvedValueOnce(profile);
      const { auth } = build(loadContext);
      const headers = new Headers();
      await expect(auth.getSessionUser(headers)).rejects.toThrow("db down");
      await expect(auth.getSessionUser(headers)).resolves.toMatchObject({ id: "user_1" });
    });
  });
});
