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
        staffRole: null,
        scopes: [],
      }),
    };
    const bidContext: IBidUserContextLoader = {
      loadContext: vi.fn().mockResolvedValue({
        role: "staff",
        staffRole: "auction_manager",
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
      staffRole: "auction_manager",
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
        staffRole: null,
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
});
