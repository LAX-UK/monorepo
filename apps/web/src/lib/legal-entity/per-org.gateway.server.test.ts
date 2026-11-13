import { X_LEGAL_ENTITY_ID_HEADER } from "@auction/http-headers";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/authed-fetch.server", () => ({ authedServerFetch: vi.fn() }));

const { createPerOrgGateway } = await import("./per-org.gateway.server");

const ORG = "00000000-0000-4000-8000-0000000000a1";
const PERSONAL = "00000000-0000-4000-8000-000000000001";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const viewedOrganisation = {
  id: ORG,
  displayName: "Northbank Gallery",
  legalName: "Northbank Gallery Ltd",
  kind: "organisation",
  subkind: "gallery",
  status: "approved",
  membership: { role: "owner", isPrimaryAdmin: false, isImpersonation: true },
};

/** A staff member's own memberships: their personal account only, never the viewed one. */
function gateway(entity: Response) {
  const fetcher = vi.fn(async (path: string) =>
    path === "/legal-entities/me"
      ? json({ data: [{ id: PERSONAL, kind: "individual", displayName: "Staff" }] })
      : entity.clone(),
  );
  return { gw: createPerOrgGateway(fetcher as never), fetcher };
}

describe("per-organisation access while viewing as the client", () => {
  it("opens the viewed organisation read-only instead of answering not found", async () => {
    const { gw, fetcher } = gateway(json({ data: viewedOrganisation }));
    const access = await gw.resolveAccess(ORG);
    expect(access.kind).toBe("ok");
    if (access.kind !== "ok") return;
    expect(access.context.member).toMatchObject({
      id: ORG,
      displayName: "Northbank Gallery",
      kind: "organisation",
      role: "owner",
      isImpersonation: true,
    });
    expect(access.context.entity).toMatchObject({ legalName: "Northbank Gallery Ltd" });
    expect(access.context.entity).not.toHaveProperty("membership");
    // The account header goes with the request, so the API can match the view session to it.
    expect(fetcher).toHaveBeenCalledWith(
      `/legal-entities/${ORG}`,
      expect.objectContaining({ headers: { [X_LEGAL_ENTITY_ID_HEADER]: ORG } }),
    );
  });

  it("gives the context to the tabs that read it", async () => {
    const { gw } = gateway(json({ data: viewedOrganisation }));
    await expect(gw.getContext(ORG)).resolves.toMatchObject({ member: { id: ORG } });
  });

  it("stays not found for an answer that is not a view session", async () => {
    const { membership: _m, ...withoutMembership } = viewedOrganisation;
    const { gw } = gateway(json({ data: withoutMembership }));
    await expect(gw.resolveAccess(ORG)).resolves.toEqual({ kind: "not_found" });
  });

  it("stays not found for a viewed personal account (it has no organisation tabs)", async () => {
    const { gw } = gateway(json({ data: { ...viewedOrganisation, kind: "individual" } }));
    await expect(gw.resolveAccess(ORG)).resolves.toEqual({ kind: "not_found" });
  });

  it("passes a refusal through", async () => {
    const { gw } = gateway(json({ error: "x", code: "not_a_member_of_legal_entity" }, 403));
    await expect(gw.resolveAccess(ORG)).resolves.toMatchObject({ kind: "forbidden" });
  });
});
