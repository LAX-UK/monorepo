import { REGISTERED_OIDC_CLIENTS } from "@auction/identity-contracts";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createOAuthTokenRequestContextMiddleware } from "../middleware/oauth-token-request-context.js";
import { createRefreshReplayGateMiddleware } from "../middleware/refresh-replay-gate.js";
import { SignInLivenessGuard } from "./refresh-sign-in-guard.js";
import {
  type IRefreshTokenFamilyRepository,
  hashRefreshToken,
} from "./refresh-token-family.ports.js";

/** A sign-in record store: the record, how long it lives, and the ids that now stand for it. */
function records() {
  const live = new Map<string, { subjectId: string; expiresAt: number }>();
  const lineage = new Map<string, string>();
  let now = 1_000;
  const find = async (sid: string) => {
    const id = live.has(sid) ? sid : lineage.get(sid);
    const record = id ? live.get(id) : undefined;
    return id && record && record.expiresAt > now ? { id, subjectId: record.subjectId } : null;
  };
  return {
    live,
    lineage,
    find,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

function guardOver(
  world: ReturnType<typeof records>,
  continuity: Record<string, string> = {},
  activity: {
    recordActivity?: (sessionId: string) => Promise<void>;
    onActivityFailed?: (error: unknown) => void;
  } = {},
) {
  return new SignInLivenessGuard({
    findLiveIdentitySession: world.find,
    peekContinuity: async (hash) => (continuity[hash] ? { sid: continuity[hash] } : null),
    recordActivity: activity.recordActivity ?? (async () => undefined),
    onActivityFailed: activity.onActivityFailed ?? (() => undefined),
  });
}

describe("SignInLivenessGuard", () => {
  it("lets a refresh through while the record behind its sid is live", async () => {
    const world = records();
    world.live.set("rec", { subjectId: "ann", expiresAt: 5_000 });

    await expect(
      guardOver(world).isLive({ userId: "ann", sid: "rec", refreshToken: "r" }),
    ).resolves.toBe(true);
  });

  it("refuses once the record has ended", async () => {
    const world = records();

    await expect(
      guardOver(world).isLive({ userId: "ann", sid: "rec", refreshToken: "r" }),
    ).resolves.toBe(false);
  });

  it("refuses once the record has expired, however long the refresh token has left", async () => {
    const world = records();
    world.live.set("rec", { subjectId: "ann", expiresAt: 5_000 });
    world.advance(5_000);

    await expect(
      guardOver(world).isLive({ userId: "ann", sid: "rec", refreshToken: "r" }),
    ).resolves.toBe(false);
  });

  it("counts a refresh as use of the record that stands for the sid, not of the old name", async () => {
    const world = records();
    world.live.set("rec", { subjectId: "ann", expiresAt: 5_000 });
    world.lineage.set("old", "rec");
    const recordActivity = vi.fn(async () => undefined);

    await guardOver(world, {}, { recordActivity }).isLive({
      userId: "ann",
      sid: "old",
      refreshToken: "r",
    });

    expect(recordActivity).toHaveBeenCalledExactlyOnceWith("rec");
  });

  it("does not count a refused refresh as use, so a record that ended is not kept alive", async () => {
    const world = records();
    world.live.set("rec", { subjectId: "ann", expiresAt: 5_000 });
    const recordActivity = vi.fn(async () => undefined);
    const guard = guardOver(world, {}, { recordActivity });

    await guard.isLive({ userId: "ben", sid: "rec", refreshToken: "r" });
    world.advance(5_000);
    await guard.isLive({ userId: "ann", sid: "rec", refreshToken: "r" });

    expect(recordActivity).not.toHaveBeenCalled();
  });

  it("lets the refresh through, and says so, when noting the use fails", async () => {
    const world = records();
    world.live.set("rec", { subjectId: "ann", expiresAt: 5_000 });
    const onActivityFailed = vi.fn();
    const failure = new Error("db down");

    await expect(
      guardOver(
        world,
        {},
        {
          recordActivity: async () => {
            throw failure;
          },
          onActivityFailed,
        },
      ).isLive({ userId: "ann", sid: "rec", refreshToken: "r" }),
    ).resolves.toBe(true);
    expect(onActivityFailed).toHaveBeenCalledWith(failure);
  });

  it("follows an earlier id to the record that took it over", async () => {
    const world = records();
    world.live.set("rec", { subjectId: "ann", expiresAt: 5_000 });
    world.lineage.set("old", "rec");

    await expect(
      guardOver(world).isLive({ userId: "ann", sid: "old", refreshToken: "r" }),
    ).resolves.toBe(true);
    world.live.delete("rec");
    await expect(
      guardOver(world).isLive({ userId: "ann", sid: "old", refreshToken: "r" }),
    ).resolves.toBe(false);
  });

  it("refuses when the record belongs to someone else", async () => {
    const world = records();
    world.live.set("rec", { subjectId: "ben", expiresAt: 5_000 });

    await expect(
      guardOver(world).isLive({ userId: "ann", sid: "rec", refreshToken: "r" }),
    ).resolves.toBe(false);
  });

  it("finds the sign-in of a token issued before it was recorded through its continuity record", async () => {
    const world = records();
    const guard = guardOver(world, { [hashRefreshToken("legacy")]: "rec" });

    await expect(guard.isLive({ userId: "ann", sid: null, refreshToken: "legacy" })).resolves.toBe(
      false,
    );
    world.live.set("rec", { subjectId: "ann", expiresAt: 5_000 });
    await expect(guard.isLive({ userId: "ann", sid: null, refreshToken: "legacy" })).resolves.toBe(
      true,
    );
  });

  it("has nothing to check for a token with no sign-in at all", async () => {
    await expect(
      guardOver(records()).isLive({ userId: "ann", sid: null, refreshToken: "none" }),
    ).resolves.toBe(true);
  });
});

const PRODUCT_CLIENTS = Object.keys(REGISTERED_OIDC_CLIENTS).filter((id) => id !== "ws-mobile");

describe("refresh after the sign-in behind it has ended", () => {
  /** The refresh gate over a real guard, for one client's token rows. */
  function setup(clientId: string) {
    const world = records();
    world.live.set("rec", { subjectId: "ann", expiresAt: 5_000 });
    const tokens = [{ id: "tok", familyId: "fam", clientId, sid: "old" as string | null }];
    world.lineage.set("old", "rec");
    const families = {
      findAndPrepare: vi.fn(async () => {
        const row = tokens.find((token) => token.clientId === clientId);
        return row
          ? {
              tokenId: row.id,
              userId: "ann",
              familyId: row.familyId,
              expiresAt: new Date(Date.now() + 30 * 86_400_000),
              sid: row.sid,
            }
          : null;
      }),
      completeRotation: vi.fn(async () => undefined),
      revokeFamily: vi.fn(async () => undefined),
      deleteFamilyTokens: vi.fn(async (familyId: string) => {
        for (let i = tokens.length - 1; i >= 0; i--) {
          if (tokens[i]?.familyId === familyId) tokens.splice(i, 1);
        }
      }),
    } satisfies IRefreshTokenFamilyRepository;
    const rotated = vi.fn();
    const store = new Map<string, string>();
    const app = new Hono();
    app.use("/api/auth/oauth2/token", createOAuthTokenRequestContextMiddleware());
    app.use(
      "/api/auth/*",
      createRefreshReplayGateMiddleware({
        families,
        signIns: guardOver(world),
        replay: {
          reserve: async (key, value) => !store.has(key) && !!store.set(key, value),
          get: async (key) => store.get(key) ?? null,
          put: async (key, value) => void store.set(key, value),
          delete: async (key) => void store.delete(key),
        },
      }),
    );
    app.post("/api/auth/oauth2/token", (c) => {
      rotated();
      return c.json({ access_token: "access", refresh_token: "refresh-next" });
    });
    const refresh = () =>
      app.request("/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=r&client_id=${clientId}`,
      });
    return { world, tokens, families, rotated, refresh };
  }

  it.each(PRODUCT_CLIENTS)(
    "%s: refresh works while its sign-in is live, through an earlier id",
    async (clientId) => {
      const { refresh, rotated } = setup(clientId);

      expect((await refresh()).status).toBe(200);
      expect(rotated).toHaveBeenCalledOnce();
    },
  );

  it.each(PRODUCT_CLIENTS)("%s: refresh is refused once the record has ended", async (clientId) => {
    const { world, refresh, rotated, tokens } = setup(clientId);
    world.live.delete("rec");

    const response = await refresh();

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_grant" });
    expect(rotated).not.toHaveBeenCalled();
    expect(tokens).toEqual([]);
  });

  it.each(PRODUCT_CLIENTS)(
    "%s: refresh is refused once the record has expired",
    async (clientId) => {
      const { world, refresh, rotated } = setup(clientId);
      world.advance(5_000);

      expect((await refresh()).status).toBe(400);
      expect(rotated).not.toHaveBeenCalled();
    },
  );
});
