import { describe, expect, it, vi } from "vitest";
import { UserDashboardHttpApplicationService } from "./user-dashboard-http-application.service.js";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const bidRow = (bidderId: string) => ({ bid: { id: `bid-${bidderId}`, bidderId }, lot: null });

function build() {
  const listBidsForBuyerAccount = vi.fn(async () => [bidRow("agent-1"), bidRow("owner-1")]);
  const service = new UserDashboardHttpApplicationService({
    userDashboardReadService: { listBidsForBuyerAccount } as never,
    recordPeople: {
      namesFor: vi.fn(async () => new Map([["agent-1", "Tom Whitfield"]])),
    },
  } as never);
  return { service, listBidsForBuyerAccount };
}

describe("listAccountBids", () => {
  it("names who placed each bid for an owner, and narrows to one sale", async () => {
    const { service, listBidsForBuyerAccount } = build();
    const res = await service.listAccountBids({
      userId: "owner-1",
      account: { legalEntityId: ACCOUNT, role: "owner" },
      saleId: "sale-1",
    });
    expect(listBidsForBuyerAccount).toHaveBeenCalledWith(ACCOUNT, null, "sale-1");
    expect(res.body).toMatchObject({
      data: [
        { placedBy: { userId: "agent-1", name: "Tom Whitfield" } },
        { placedBy: { userId: "owner-1", name: null } },
      ],
    });
  });

  it("reads a buyer agent's own bids and refuses finance", async () => {
    const { service, listBidsForBuyerAccount } = build();
    await service.listAccountBids({
      userId: "agent-1",
      account: { legalEntityId: ACCOUNT, role: "buyer_agent" },
    });
    expect(listBidsForBuyerAccount).toHaveBeenCalledWith(ACCOUNT, "agent-1", undefined);
    const refused = await service.listAccountBids({
      userId: "fin-1",
      account: { legalEntityId: ACCOUNT, role: "finance" },
    });
    expect(refused.status).toBe(403);
  });
});

describe("purchases list only ended lots", () => {
  function buildPurchases() {
    const list = vi.fn(async () => []);
    const service = new UserDashboardHttpApplicationService({
      lotService: { list },
      paymentBuyerService: {
        listMyPaymentsForBuyerApi: vi.fn(async () => ({ data: [] })),
        listEntityPaymentsForBuyerApi: vi.fn(async () => ({ data: [] })),
      },
      saleService: {},
      mediaUrlResolver: {},
    } as never);
    return { service, list };
  }

  it("never reads an open lot with a provisional leader as a personal purchase", async () => {
    const { service, list } = buildPurchases();
    await service.listPortfolio({ userId: "buyer-1" });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ winnerId: "buyer-1", statuses: ["ended"] }),
    );
  });

  it("reads an organisation's purchases with the same rule", async () => {
    const { service, list } = buildPurchases();
    await service.listAccountPurchases({
      userId: "owner-1",
      account: { legalEntityId: ACCOUNT, role: "owner" },
    });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ buyerLegalEntityId: ACCOUNT, statuses: ["ended"] }),
    );
  });
});
