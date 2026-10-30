import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { ContainerOrganisationWorkspaceRoutesSlice } from "../container.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAccountRecordSearchService } from "../services/interfaces/account-record-search-service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { INeedsYouService } from "../services/interfaces/needs-you-service.js";
import { createOrganisationWorkspaceRoutes } from "./organisation-workspace.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";

function mount(
  role: LegalEntityMemberRole,
  search: IAccountRecordSearchService["search"],
  read: INeedsYouService["read"] = vi.fn(),
) {
  const context = {
    legalEntityId: ENTITY,
    userId: "member-1",
    role,
    isPrimaryAdmin: role === "owner",
  } as LegalEntityContext;
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    requireLegalEntityContext: async (
      c: { set: (key: string, value: LegalEntityContext) => void },
      next: () => Promise<void>,
    ) => {
      c.set("legalEntityContext", context);
      await next();
    },
    organisationWorkspace: { search: { search }, needsYou: { read } },
  } as unknown as ContainerOrganisationWorkspaceRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "member-1", role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/legal-entities", createOrganisationWorkspaceRoutes(container, authenticator));
  return app;
}

describe("organisation workspace routes: search", () => {
  it("searches the acting account as the member, with dates as ISO strings", async () => {
    const search = vi.fn(async () =>
      ok({
        searchable: ["bids" as const],
        groups: [
          {
            group: "bids" as const,
            items: [
              {
                lotId: "lot-1",
                title: "Pool",
                artistName: "David Hockney",
                lotNumber: 3,
                saleId: null,
                saleTitle: null,
                lotStatus: "ended" as const,
                endsAt: new Date("2026-10-01T12:00:00Z"),
              },
            ],
            nextOffset: null,
          },
        ],
      }),
    );
    const res = await mount("buyer_agent", search).request(
      "/legal-entities/search?q=pool&group=bids&limit=10",
    );
    expect(res.status).toBe(200);
    expect(search).toHaveBeenCalledWith(
      {
        userId: "member-1",
        legalEntityId: ENTITY,
        role: "buyer_agent",
        isImpersonation: undefined,
      },
      { q: "pool", group: "bids", limit: 10, offset: 0 },
    );
    const body = (await res.json()) as { data: { groups: { items: { endsAt: string }[] }[] } };
    expect(body.data.groups[0]?.items[0]?.endsAt).toBe("2026-10-01T12:00:00.000Z");
  });

  it("answers 403 with the reason key for a group the role cannot open", async () => {
    const search = vi.fn(async () =>
      err({
        code: "insufficient_entity_role" as const,
        status: 403 as const,
        message: "You can't search these records for this account.",
      }),
    );
    const res = await mount("consignor", search).request("/legal-entities/search?q=a&group=bids");
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "insufficient_entity_role" });
  });

  it("rejects an unknown group or a missing query before searching", async () => {
    const search = vi.fn();
    const app = mount("owner", search);
    expect((await app.request("/legal-entities/search?q=a&group=lots")).status).toBe(400);
    expect((await app.request("/legal-entities/search")).status).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });
});

describe("organisation workspace routes: needs you", () => {
  it("reads the member's tasks for the acting account, dates as ISO strings", async () => {
    const read = vi.fn(async () => ({
      kinds: ["outbid" as const],
      tasks: [
        {
          kind: "outbid" as const,
          lots: [{ id: "l1", title: "Pool", endsAt: new Date("2026-11-10T14:00:00Z") }],
          link: { page: "lot" as const, id: "l1" },
        },
      ],
      counts: { bids: 1, purchases: 0, consignments: 0, team: 0, organisation: 0 },
      truncated: false,
    }));
    const res = await mount("buyer_agent", vi.fn(), read).request("/legal-entities/needs-you");
    expect(res.status).toBe(200);
    expect(read).toHaveBeenCalledWith({
      userId: "member-1",
      legalEntityId: ENTITY,
      role: "buyer_agent",
      isImpersonation: undefined,
    });
    const body = (await res.json()) as {
      data: { tasks: { lots: { endsAt: string }[] }[]; counts: { bids: number } };
    };
    expect(body.data.tasks[0]?.lots[0]?.endsAt).toBe("2026-11-10T14:00:00.000Z");
    expect(body.data.counts.bids).toBe(1);
  });
});
