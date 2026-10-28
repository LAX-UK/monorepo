import type {
  BuyerAgentAuthorisationRecord,
  SaleRegistrationRow,
} from "@auction/persistence/interfaces";
import type { Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { MyBuyerAgentAuthorisationsService } from "./my-buyer-agent-authorisations.service.js";

const NOW = new Date("2026-10-28T09:00:00Z");

function record(overrides: Partial<BuyerAgentAuthorisationRecord>): BuyerAgentAuthorisationRecord {
  return {
    id: "a1",
    legalEntityId: "org1",
    userId: "agent",
    userName: "Sam",
    userEmail: "sam@example.com",
    saleId: "sale1",
    saleTitle: "Contemporary",
    bidLimit: "10000.00",
    validFrom: new Date("2026-10-01"),
    validUntil: null,
    status: "active",
    createdByUserId: "owner",
    createdByName: "Jane Smith",
    createdAt: new Date("2026-10-01"),
    revokedAt: null,
    revokedReason: null,
    ...overrides,
  };
}

const SALE = {
  id: "sale1",
  title: "Contemporary",
  startTime: new Date("2026-11-04T18:00:00Z"),
  endTime: new Date("2026-11-04T21:00:00Z"),
} as Sale;

function service(
  records: BuyerAgentAuthorisationRecord[],
  registration: SaleRegistrationRow | null,
) {
  return new MyBuyerAgentAuthorisationsService({
    directory: { listForLegalEntity: async () => records },
    sales: { findById: async (id) => (id === SALE.id ? SALE : null) },
    registrations: { findBySaleUserEntity: async () => registration },
    now: () => NOW,
  });
}

const agent = { userId: "agent", legalEntityId: "org1", role: "buyer_agent" as const };

describe("MyBuyerAgentAuthorisationsService", () => {
  it("lists the agent's own authorisations in force, with the sale and registration", async () => {
    const rows = await service([record({})], null).list(agent);
    expect(rows).toEqual([
      {
        bidLimit: "10000.00",
        validUntil: null,
        sale: {
          id: "sale1",
          title: "Contemporary",
          startTime: SALE.startTime.toISOString(),
          registered: false,
        },
      },
    ]);
  });

  it("counts a pending or approved registration as registered", async () => {
    const registration = { status: "pending" } as SaleRegistrationRow;
    const [row] = await service([record({})], registration).list(agent);
    expect(row?.sale?.registered).toBe(true);
  });

  it("leaves out other members' authorisations, revoked, expired and future ones", async () => {
    const rows = await service(
      [
        record({ userId: "someone-else" }),
        record({ status: "revoked" }),
        record({ validUntil: new Date("2026-10-20") }),
        record({ validFrom: new Date("2026-11-01") }),
      ],
      null,
    ).list(agent);
    expect(rows).toEqual([]);
  });

  it("returns an all-sales authorisation without a sale", async () => {
    const rows = await service([record({ saleId: null, saleTitle: null })], null).list(agent);
    expect(rows).toEqual([{ bidLimit: "10000.00", validUntil: null, sale: null }]);
  });

  it("is empty for roles that bid without an authorisation", async () => {
    expect(await service([record({})], null).list({ ...agent, role: "owner" })).toEqual([]);
  });
});
