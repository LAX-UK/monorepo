import type { LegalEntitySummary } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountsUnavailableError } from "./accounts-unavailable-error";

vi.mock("server-only", () => ({}));

const resolveActingContext = vi.fn();
vi.mock("@/lib/legal-entity/acting-context.server", () => ({
  resolveActingContext: (...args: unknown[]) => resolveActingContext(...args),
}));

const { resolveSellerWorkspaceContext, sellerCan } = await import("./seller-acting-context.server");

function entity(overrides: Partial<LegalEntitySummary>): LegalEntitySummary {
  return {
    id: "me",
    displayName: "Alex Morgan",
    kind: "individual",
    subkind: "private_collector",
    status: "approved",
    role: "owner",
    isPrimaryAdmin: true,
    ...overrides,
  };
}

const personal = entity({});
const gallery = (role: LegalEntitySummary["role"], extra: Partial<LegalEntitySummary> = {}) =>
  entity({
    id: "org-1",
    displayName: "Northbank Gallery",
    kind: "organisation",
    subkind: "gallery",
    role,
    ...extra,
  });

function acting(current: LegalEntitySummary, memberships: LegalEntitySummary[]) {
  resolveActingContext.mockResolvedValue({
    acting: current,
    memberships,
    impersonation: null,
    needsRestore: false,
  });
}

describe("resolveSellerWorkspaceContext", () => {
  beforeEach(() => {
    resolveActingContext.mockReset();
  });

  it("sells as the person when no organisation is chosen", async () => {
    acting(personal, [personal, gallery("owner")]);
    const ctx = await resolveSellerWorkspaceContext("client", []);
    expect(ctx).toMatchObject({
      sellerEntityId: "me",
      sellingAsOrganisation: false,
      actor: null,
    });
  });

  it("sells as the organisation chosen in the picker, with the member's role", async () => {
    acting(gallery("finance"), [personal, gallery("finance")]);
    const ctx = await resolveSellerWorkspaceContext("client", []);
    expect(ctx).toMatchObject({
      sellerEntityId: "org-1",
      sellingAsOrganisation: true,
      actor: { role: "finance" },
    });
    expect(ctx.personalEntity?.id).toBe("me");
  });

  it("never falls back to the personal profile when the accounts could not be read", async () => {
    const outage = new AccountsUnavailableError("rate_limited");
    resolveActingContext.mockRejectedValue(outage);
    await expect(resolveSellerWorkspaceContext("client", [])).rejects.toBe(outage);
  });
});

describe("sellerCan", () => {
  async function ctxFor(role: LegalEntitySummary["role"], extra: Partial<LegalEntitySummary> = {}) {
    acting(gallery(role, extra), [personal, gallery(role, extra)]);
    return resolveSellerWorkspaceContext("client", []);
  }

  it("gives a person every capability on their own profile", async () => {
    acting(personal, [personal]);
    const ctx = await resolveSellerWorkspaceContext("client", []);
    expect(sellerCan(ctx, "entity.payouts.read")).toBe(true);
    expect(sellerCan(ctx, "entity.security.manage")).toBe(true);
  });

  it("follows the capability matrix for organisation roles", async () => {
    expect(sellerCan(await ctxFor("finance"), "entity.payouts.read")).toBe(true);
    expect(sellerCan(await ctxFor("consignor"), "entity.payouts.read")).toBe(false);
    expect(sellerCan(await ctxFor("consignor"), "entity.consignments.read")).toBe(true);
    expect(sellerCan(await ctxFor("viewer"), "entity.finance.read")).toBe(false);
    expect(sellerCan(await ctxFor("viewer"), "entity.holdings.read")).toBe(true);
  });

  it("keeps an impersonating admin read-only", async () => {
    const impersonating = await ctxFor("owner", { isImpersonation: true });
    expect(sellerCan(impersonating, "entity.payouts.read")).toBe(true);
    expect(sellerCan(impersonating, "entity.connect.manage")).toBe(false);
  });
});
