import type { LegalEntityMemberRole, Payout } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import {
  OrganisationStatementsService,
  STATEMENT_LIST_LIMIT,
} from "./organisation-statements.service.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";

function payout(id: string, periodEnd: string, fields: Partial<Payout> = {}): Payout {
  return {
    id,
    legalEntityId: ENTITY,
    periodStart: new Date("2026-09-01T00:00:00Z"),
    periodEnd: new Date(periodEnd),
    grossAmount: "15344.00",
    platformFee: "2484.00",
    stripeFee: "0",
    netAmount: "12860.00",
    currency: "GBP",
    status: "paid",
    stripeTransferId: null,
    xeroBillId: null,
    failureReason: null,
    processedAt: null,
    statementUrl: null,
    statementGenerationError: null,
    createdAt: new Date(periodEnd),
    ...fields,
  };
}

const actor = (role: LegalEntityMemberRole, isImpersonation?: boolean) => ({
  userId: "me",
  legalEntityId: ENTITY,
  role,
  isImpersonation,
});

function setup(rows: Payout[]) {
  const list = vi.fn(async () => rows);
  return { service: new OrganisationStatementsService({ payouts: { list } }), list };
}

describe("OrganisationStatementsService", () => {
  it.each(["owner", "admin", "finance"] as const)(
    "lists the statements, newest first, for %s",
    async (role) => {
      const { service, list } = setup([
        payout("older", "2026-09-30T00:00:00Z", { statementUrl: "https://spaces/s.pdf" }),
        payout("newer", "2026-10-31T00:00:00Z", { status: "in_transit" }),
        payout("failed", "2026-08-31T00:00:00Z", { statementGenerationError: "render" }),
      ]);
      const rows = (await service.list(actor(role)))._unsafeUnwrap();
      expect(list).toHaveBeenCalledWith({ legalEntityId: ENTITY, limit: STATEMENT_LIST_LIMIT });
      expect(rows.map((r) => [r.payoutId, r.availability, r.payoutStatus])).toEqual([
        ["newer", "on_request", "in_transit"],
        ["older", "ready", "paid"],
        ["failed", "unavailable", "paid"],
      ]);
      expect(rows[0]).toMatchObject({
        kind: "payout",
        netAmount: "12860.00",
        currency: "GBP",
        periodEnd: "2026-10-31T00:00:00.000Z",
      });
    },
  );

  it("never exposes the stored file address", async () => {
    const { service } = setup([
      payout("p", "2026-09-30T00:00:00Z", { statementUrl: "https://spaces/s.pdf" }),
    ]);
    const [row] = (await service.list(actor("owner")))._unsafeUnwrap();
    expect(JSON.stringify(row)).not.toContain("spaces");
  });

  it("leaves out another organisation's payouts", async () => {
    const { service } = setup([
      payout("mine", "2026-09-30T00:00:00Z"),
      payout("theirs", "2026-09-30T00:00:00Z", { legalEntityId: "other" }),
    ]);
    const rows = (await service.list(actor("finance")))._unsafeUnwrap();
    expect(rows.map((r) => r.payoutId)).toEqual(["mine"]);
  });

  it.each(["consignor", "buyer_agent", "viewer"] as const)("refuses %s", async (role) => {
    const { service, list } = setup([]);
    expect((await service.list(actor(role)))._unsafeUnwrapErr().status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });

  it("lets support staff read", async () => {
    const { service } = setup([]);
    expect((await service.list(actor("owner", true))).isOk()).toBe(true);
  });
});
