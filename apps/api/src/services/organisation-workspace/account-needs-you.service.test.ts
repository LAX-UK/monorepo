import type { LegalEntitySummary } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { INeedsYouService, NeedsYouView } from "../interfaces/needs-you-service.js";
import { AccountNeedsYouService } from "./account-needs-you.service.js";

function membership(id: string, overrides: Partial<LegalEntitySummary> = {}): LegalEntitySummary {
  return {
    id,
    displayName: id,
    kind: "organisation",
    subkind: "company",
    status: "approved",
    role: "owner",
    isPrimaryAdmin: false,
    ...overrides,
  } as LegalEntitySummary;
}

function view(tasks: number): NeedsYouView {
  return {
    kinds: [],
    tasks: Array.from({ length: tasks }, (_, i) => ({
      kind: "agreement" as const,
      consignment: { id: `c${i}`, title: "Untitled" },
      link: { page: "consignment" as const, id: `c${i}` },
    })),
    counts: { bids: 0, purchases: 0, consignments: tasks, team: 0, organisation: 0 },
    truncated: false,
  };
}

describe("AccountNeedsYouService", () => {
  it("reads each organisation as the member's own role and counts its tasks", async () => {
    const read = vi.fn<INeedsYouService["read"]>(async (actor) =>
      view(actor.legalEntityId === "org-a" ? 2 : 0),
    );
    const service = new AccountNeedsYouService({
      memberships: {
        listActiveMembershipsForUser: vi.fn(async () => [
          membership("me", { kind: "individual" }),
          membership("org-a", { role: "finance" }),
          membership("org-b", { role: "consignor" }),
        ]),
      },
      needsYou: { read },
    });

    expect(await service.countsFor("user-1")).toEqual([
      { legalEntityId: "me", count: 0 },
      { legalEntityId: "org-a", count: 2 },
      { legalEntityId: "org-b", count: 0 },
    ]);
    expect(read).toHaveBeenCalledWith({
      userId: "user-1",
      legalEntityId: "org-a",
      role: "finance",
    });
    expect(read).toHaveBeenCalledWith({
      userId: "user-1",
      legalEntityId: "org-b",
      role: "consignor",
    });
    // The personal account is never read on its own: its count comes from the person's tasks.
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("puts the person's own tasks on their personal account, not on each organisation", async () => {
    const identity = { kind: "identity" as const, link: { page: "verify_identity" as const } };
    const funds = { kind: "source_of_funds" as const, link: { page: "source_of_funds" as const } };
    const service = new AccountNeedsYouService({
      memberships: {
        listActiveMembershipsForUser: vi.fn(async () => [
          membership("me", { kind: "individual" }),
          membership("org-a"),
          membership("org-b", { role: "viewer" }),
        ]),
      },
      needsYou: {
        // The viewer role is not asked for its identity; the owner role is.
        read: vi.fn(async (actor) => ({
          ...view(1),
          tasks: [
            ...view(1).tasks,
            ...(actor.legalEntityId === "org-a" ? [identity, funds] : [funds]),
          ],
        })),
      },
    });
    expect(await service.countsFor("user-1")).toEqual([
      { legalEntityId: "me", count: 2 },
      { legalEntityId: "org-a", count: 1 },
      { legalEntityId: "org-b", count: 1 },
    ]);
  });

  it("leaves out an account whose read fails, and still answers for the rest", async () => {
    const service = new AccountNeedsYouService({
      memberships: {
        listActiveMembershipsForUser: vi.fn(async () => [membership("org-a"), membership("org-b")]),
      },
      needsYou: {
        read: vi.fn(async (actor) => {
          if (actor.legalEntityId === "org-a") throw new Error("down");
          return view(1);
        }),
      },
    });
    expect(await service.countsFor("user-1")).toEqual([{ legalEntityId: "org-b", count: 1 }]);
  });

  it("never reads more than four accounts at once and keeps the membership order", async () => {
    let running = 0;
    let peak = 0;
    const ids = Array.from({ length: 9 }, (_, i) => `org-${i}`);
    const service = new AccountNeedsYouService({
      memberships: {
        listActiveMembershipsForUser: vi.fn(async () => ids.map((id) => membership(id))),
      },
      needsYou: {
        read: vi.fn(async () => {
          running += 1;
          peak = Math.max(peak, running);
          await new Promise((resolve) => setTimeout(resolve, 1));
          running -= 1;
          return view(1);
        }),
      },
    });
    const counts = await service.countsFor("user-1");
    expect(peak).toBeLessThanOrEqual(4);
    expect(counts.map((c) => c.legalEntityId)).toEqual(ids);
  });

  it("skips a synthetic support row", async () => {
    const read = vi.fn(async () => view(1));
    const service = new AccountNeedsYouService({
      memberships: {
        listActiveMembershipsForUser: vi.fn(async () => [
          membership("org-a", { isImpersonation: true }),
        ]),
      },
      needsYou: { read },
    });
    expect(await service.countsFor("user-1")).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });
});
