import type { LegalEntitySummary } from "@auction/types";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/session.reader", () => ({ getServerSessionUser: vi.fn() }));
vi.mock("@/lib/legal-entity/acting-context.server", () => ({ resolveActingContext: vi.fn() }));
vi.mock("@/lib/legal-entity/org-module-host.server", () => ({
  resolveOrgModuleEnabledFromRequest: vi.fn(),
}));

const { scopedAccountFor } = await import("./account-scope.server");

const individual: LegalEntitySummary = {
  id: "client-personal",
  displayName: "Jane Smith",
  kind: "individual",
  subkind: "private_collector",
  status: "approved",
  role: "owner",
  isPrimaryAdmin: true,
};

describe("scopedAccountFor", () => {
  it("marks a personal account support is viewing, so its records are read by its id", () => {
    expect(scopedAccountFor({ ...individual, isImpersonation: true })).toEqual({
      kind: "personal",
      id: "client-personal",
      isImpersonation: true,
    });
  });

  it("leaves the person's own account as it was", () => {
    expect(scopedAccountFor(individual)).toEqual({ kind: "personal", id: "client-personal" });
    expect(scopedAccountFor(null)).toEqual({ kind: "personal", id: null });
  });
});
