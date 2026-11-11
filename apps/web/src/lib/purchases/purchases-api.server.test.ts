import type { ScopedAccount } from "@/lib/account-scope/account-scope";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const scope = vi.fn();
const authedServerFetch = vi.fn();

vi.mock("@/lib/data/container.server", () => ({
  getServerDataContainer: async () => ({ buying: { scope } }),
}));
vi.mock("@/lib/data/http/authed-fetch.server", () => ({
  authedServerFetch: (...args: unknown[]) => authedServerFetch(...args),
}));

import { purchasesApiFetch } from "./purchases-api.server";

const organisation = {
  kind: "organisation",
  id: "org-1",
  name: "Org",
  actor: { role: "owner", isImpersonation: false },
} as ScopedAccount;

function actingAs(account: ScopedAccount) {
  scope.mockResolvedValue({ account, actor: { userId: "user-1" } });
}

function sentHeaders(): Record<string, string> {
  return authedServerFetch.mock.calls[0]?.[1].headers;
}

describe("purchasesApiFetch", () => {
  beforeEach(() => {
    scope.mockReset();
    authedServerFetch.mockReset();
    authedServerFetch.mockResolvedValue(new Response(null));
  });

  it("names a person's own account, so the pay routes that need an account answer", async () => {
    actingAs({ kind: "personal", id: "person-1" });
    await purchasesApiFetch("/pay-plan?lots=a");
    expect(authedServerFetch).toHaveBeenCalledWith(
      "/legal-entities/purchases/pay-plan?lots=a",
      expect.anything(),
    );
    expect(sentHeaders()["x-legal-entity-id"]).toBe("person-1");
  });

  it("names the organisation in use", async () => {
    actingAs(organisation);
    await purchasesApiFetch("/pay-plan?lots=a");
    expect(sentHeaders()["x-legal-entity-id"]).toBe("org-1");
  });

  it("names nothing while a person's own account is not known", async () => {
    actingAs({ kind: "personal", id: null });
    await purchasesApiFetch("/pay-plan?lots=a");
    expect(sentHeaders()).not.toHaveProperty("x-legal-entity-id");
  });
});
