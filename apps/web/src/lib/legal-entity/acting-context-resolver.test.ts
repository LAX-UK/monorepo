import {
  FakeAccountDirectory,
  ORGANISATION_ACCOUNT,
  PERSONAL_ACCOUNT,
} from "@/test/fake-account-directory";
import { describe, expect, it } from "vitest";
import { type ActingContextDeps, resolveActingContextWith } from "./acting-context-resolver";

function deps(overrides: Partial<ActingContextDeps> = {}): ActingContextDeps {
  return {
    directory: new FakeAccountDirectory([PERSONAL_ACCOUNT, ORGANISATION_ACCOUNT]),
    browserChoice: { accountId: ORGANISATION_ACCOUNT.id, viewSessionId: null },
    orgModuleEnabled: async () => true,
    canViewAsClient: false,
    ...overrides,
  };
}

describe("resolveActingContextWith", () => {
  it("acts as the organisation this browser chose", async () => {
    const lookup = await resolveActingContextWith(deps());
    expect(lookup).toMatchObject({
      ok: true,
      context: { acting: { id: ORGANISATION_ACCOUNT.id }, needsRestore: false },
    });
  });

  it.each(["rate_limited", "server_error", "timeout", "network"] as const)(
    "reports a %s lookup as a failure, never as the personal account",
    async (reason) => {
      const directory = new FakeAccountDirectory([PERSONAL_ACCOUNT]).failWith(reason);
      await expect(resolveActingContextWith(deps({ directory }))).resolves.toEqual({
        ok: false,
        reason,
      });
    },
  );

  it("asks the directory for the browser's account, so a cached answer without it is re-read", async () => {
    const directory = new FakeAccountDirectory([PERSONAL_ACCOUNT, ORGANISATION_ACCOUNT]);
    await resolveActingContextWith(deps({ directory }));
    expect(directory.listCalls).toEqual([{ mustInclude: ORGANISATION_ACCOUNT.id }]);
  });

  it("opens the personal account and asks for a restore when the organisation is gone", async () => {
    const directory = new FakeAccountDirectory([PERSONAL_ACCOUNT]);
    await expect(resolveActingContextWith(deps({ directory }))).resolves.toMatchObject({
      ok: true,
      context: { acting: { id: PERSONAL_ACCOUNT.id }, needsRestore: true },
    });
  });

  it("asks for a restore on a new device", async () => {
    await expect(resolveActingContextWith(deps({ browserChoice: null }))).resolves.toMatchObject({
      ok: true,
      context: { acting: { id: PERSONAL_ACCOUNT.id }, needsRestore: true },
    });
  });

  it("hides an organisation while organisations are switched off", async () => {
    const lookup = await resolveActingContextWith(deps({ orgModuleEnabled: async () => false }));
    expect(lookup).toMatchObject({ ok: true, context: { acting: { id: PERSONAL_ACCOUNT.id } } });
  });

  it("shows a staff member the account they are viewing as, and never restores over it", async () => {
    const viewed = { ...ORGANISATION_ACCOUNT, isImpersonation: true as const };
    const directory = new FakeAccountDirectory([PERSONAL_ACCOUNT]).viewing({
      account: viewed,
      expiresAtIso: "2026-10-29T18:00:00.000Z",
    });
    const lookup = await resolveActingContextWith(
      deps({
        directory,
        canViewAsClient: true,
        browserChoice: { accountId: viewed.id, viewSessionId: "session-1" },
      }),
    );
    expect(lookup).toMatchObject({
      ok: true,
      context: {
        acting: { id: viewed.id, isImpersonation: true },
        impersonation: { sessionId: "session-1", displayName: "Northbank Gallery" },
        needsRestore: false,
      },
    });
  });

  it("ignores a view-as cookie for someone who may not view as a client", async () => {
    const directory = new FakeAccountDirectory([PERSONAL_ACCOUNT]).viewing({
      account: { ...ORGANISATION_ACCOUNT, isImpersonation: true },
      expiresAtIso: null,
    });
    const lookup = await resolveActingContextWith(
      deps({
        directory,
        browserChoice: { accountId: ORGANISATION_ACCOUNT.id, viewSessionId: "session-1" },
      }),
    );
    expect(lookup).toMatchObject({
      ok: true,
      context: { acting: { id: PERSONAL_ACCOUNT.id }, impersonation: null, needsRestore: false },
    });
  });
});
