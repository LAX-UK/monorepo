import type { LivePaymentGroupFacts } from "@auction/persistence/interfaces";
import type { PayPlanProgress } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { PayProgressReadService } from "./pay-progress-read.service.js";

const LOT = "aaaaaaaa-0000-4000-8000-000000000001";
const actor = (role: OrganisationMemberActor["role"]): OrganisationMemberActor => ({
  userId: `${role}-1`,
  legalEntityId: "account-1",
  role,
});
const group: LivePaymentGroupFacts = {
  id: "group-1",
  status: "open",
  checkoutRail: "gb_bank_transfer",
  stripeCheckoutSessionId: "cs_1",
  totalAmount: "100.00",
  amountReceived: "0.00",
  memberCount: 1,
};
const PROGRESS: PayPlanProgress = {
  rail: "bank_transfer",
  stage: "awaiting_transfer",
  lots: [{ lotId: LOT, title: "Harbour", lotNumber: 1, saleTitle: null, totalPence: 10_000 }],
  totalPence: 10_000,
  receivedPence: 0,
  remainingPence: 10_000,
  receivedPercent: 0,
  otherInvoices: 0,
};

function setup(
  over: { group?: LivePaymentGroupFacts | null; progress?: PayPlanProgress | null } = {},
) {
  const g = over.group === undefined ? group : over.group;
  const resolve = vi.fn(
    async () => new Map(g ? [[g.id, over.progress === undefined ? PROGRESS : over.progress]] : []),
  );
  const service = new PayProgressReadService({
    candidates: {
      read: async () => ({
        entries: [
          {
            lotId: LOT,
            row: {
              lotId: LOT,
              lotTitle: "Harbour",
              lotNumber: 1,
              saleTitle: null,
              payment: { amount: "100.00" },
            } as never,
            view: {} as never,
            flags: { heldForReview: false, inPaymentInProgress: g !== null, group: g },
          },
        ],
        winners: new Map(),
      }),
    },
    progress: { resolve },
  });
  return { service, resolve };
}

describe("PayProgressReadService", () => {
  it("answers where the payment under way stands", async () => {
    expect((await setup().service.progress(actor("finance"), [LOT]))._unsafeUnwrap()).toEqual({
      progress: PROGRESS,
    });
  });

  it("answers null when no payment is under way, or the payer never finished it", async () => {
    expect(
      (await setup({ group: null }).service.progress(actor("finance"), [LOT]))._unsafeUnwrap(),
    ).toEqual({ progress: null });
    expect(
      (await setup({ progress: null }).service.progress(actor("finance"), [LOT]))._unsafeUnwrap(),
    ).toEqual({ progress: null });
  });

  it("is open to a member who only follows purchases, and refuses a bad pick", async () => {
    expect((await setup().service.progress(actor("buyer_agent"), [LOT])).isOk()).toBe(true);
    expect((await setup().service.progress(actor("finance"), []))._unsafeUnwrapErr().code).toBe(
      "pay_several_empty",
    );
    expect((await setup().service.progress(actor("viewer"), [LOT]))._unsafeUnwrapErr().code).toBe(
      "insufficient_entity_role",
    );
  });

  it("answers unavailable, never a guess, when it cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { service, resolve } = setup();
    resolve.mockRejectedValueOnce(new Error("db down"));
    expect((await service.progress(actor("finance"), [LOT]))._unsafeUnwrapErr().code).toBe(
      "pay_plan_unavailable",
    );
  });
});
