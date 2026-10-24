import { AUDIT_DOMAIN_EVENTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: (_name: string, fn: () => Promise<unknown>) => fn(),
}));

const denyUnlessAdminCapability = vi.fn();
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: (...args: unknown[]) => denyUnlessAdminCapability(...args),
}));

const searchActors = vi.fn();
vi.mock("@/lib/data/http/admin.server", () => ({
  searchAdminAuditActors: (...args: unknown[]) => searchActors(...args),
}));

import { searchAuditActorsAction } from "./admin-audit-actors";

describe("searchAuditActorsAction", () => {
  beforeEach(() => {
    denyUnlessAdminCapability.mockReset().mockResolvedValue(null);
    searchActors.mockReset().mockResolvedValue([{ userId: "u1", name: "Ada", email: "a@x.test" }]);
  });

  it("is gated on the audit read capability and searches nothing when denied", async () => {
    denyUnlessAdminCapability.mockResolvedValue({ ok: false, error: "no", status: 403 });

    const result = await searchAuditActorsAction("ada");

    expect(denyUnlessAdminCapability).toHaveBeenCalledWith(AUDIT_DOMAIN_EVENTS_ACCESS);
    expect(result.ok).toBe(false);
    expect(searchActors).not.toHaveBeenCalled();
  });

  it("returns matching people for a trimmed query", async () => {
    const result = await searchAuditActorsAction("  ada ");

    expect(searchActors).toHaveBeenCalledWith({ q: "ada", limit: 20 });
    expect(result).toMatchObject({ ok: true, data: { actors: [{ userId: "u1" }] } });
  });

  it("reports a failed search without leaking the cause", async () => {
    searchActors.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1"));

    const result = await searchAuditActorsAction("ada");

    expect(result).toMatchObject({ ok: false, error: "People could not be searched. Try again." });
  });
});
