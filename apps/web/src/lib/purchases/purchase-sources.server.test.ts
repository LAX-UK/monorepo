import type { ScopedAccount } from "@/lib/account-scope/account-scope";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const scope = vi.fn();
const listMine = vi.fn();
const getServerEntityPayments = vi.fn();

vi.mock("@/lib/data/container.server", () => ({
  getServerDataContainer: async () => ({
    buying: {
      scope,
      purchases: async () => [],
      amountsOwed: async () => ({ entries: [] }),
    },
    payments: { listMine, getLotFulfilmentForWinner: vi.fn() },
  }),
}));
vi.mock("@/lib/data/http/payments.server", () => ({
  getServerEntityPayments: () => getServerEntityPayments(),
}));
vi.mock("@/lib/data/http/account-buying.server", () => ({
  getServerAccountPurchaseFacts: async () => [],
}));
vi.mock("@/lib/data/sale-titles.server", () => ({
  resolveSaleTitles: async () => ({}),
}));

import { loadPurchaseSources } from "./purchase-sources.server";

function actingAs(account: ScopedAccount) {
  scope.mockResolvedValue({ account, actor: { userId: "staff-1" } });
}

const payment = { lotId: "lot-1" };

describe("loadPurchaseSources invoices", () => {
  beforeEach(() => {
    scope.mockReset();
    listMine.mockReset().mockResolvedValue([{ lotId: "own-lot" }]);
    getServerEntityPayments.mockReset().mockResolvedValue([payment]);
  });

  it("reads the person's own payments on their own account", async () => {
    actingAs({ kind: "personal", id: "person-1" });
    const sources = await loadPurchaseSources();
    expect(listMine).toHaveBeenCalledTimes(1);
    expect(getServerEntityPayments).not.toHaveBeenCalled();
    expect(Object.keys(sources?.invoiceByLot ?? {})).toEqual(["own-lot"]);
  });

  it("reads the viewed account's payments, never the staff member's own, while viewing a person", async () => {
    actingAs({ kind: "personal", id: "person-1", isImpersonation: true });
    const sources = await loadPurchaseSources();
    expect(getServerEntityPayments).toHaveBeenCalledTimes(1);
    expect(listMine).not.toHaveBeenCalled();
    expect(Object.keys(sources?.invoiceByLot ?? {})).toEqual(["lot-1"]);
  });
});
