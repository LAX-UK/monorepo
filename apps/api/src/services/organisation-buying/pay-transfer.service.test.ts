import type { LivePaymentGroupFacts } from "@auction/persistence/interfaces";
import type { BankTransferInstructions, PayPlanProgress } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { PayTransferService } from "./pay-transfer.service.js";

const LOT = "aaaaaaaa-0000-4000-8000-000000000001";
const INSTRUCTIONS: BankTransferInstructions = {
  accountName: "London Auction Xchange LTD",
  sortCode: "231470",
  accountNumber: "41926638",
  reference: "LAXB7KQ2R9",
};

const actor = (role: OrganisationMemberActor["role"]): OrganisationMemberActor => ({
  userId: `${role}-1`,
  legalEntityId: "account-1",
  role,
});

const group = (over: Partial<LivePaymentGroupFacts> = {}): LivePaymentGroupFacts => ({
  id: "group-1",
  status: "open",
  checkoutRail: "gb_bank_transfer",
  stripeCheckoutSessionId: "cs_1",
  totalAmount: "100.00",
  amountReceived: "0.00",
  memberCount: 2,
  ...over,
});

const PROGRESS: PayPlanProgress = {
  rail: "bank_transfer",
  stage: "awaiting_transfer",
  lots: [{ lotId: LOT, title: "Harbour", lotNumber: 1, saleTitle: "Autumn", totalPence: 10_000 }],
  totalPence: 10_000,
  receivedPence: 0,
  remainingPence: 10_000,
  receivedPercent: 0,
  otherInvoices: 0,
};

function setup(
  over: {
    group?: LivePaymentGroupFacts | null;
    progress?: PayPlanProgress | null;
    read?: () => Promise<BankTransferInstructions | null>;
  } = {},
) {
  const g = over.group === undefined ? group() : over.group;
  const read = vi.fn(over.read ?? (async () => INSTRUCTIONS));
  const candidates = {
    read: vi.fn(async () => ({
      entries: [
        {
          lotId: LOT,
          row: {
            lotId: LOT,
            lotTitle: "Harbour",
            lotNumber: 1,
            saleTitle: "Autumn",
            payment: { amount: "100.00" },
          } as never,
          view: {} as never,
          flags: { heldForReview: false, inPaymentInProgress: g !== null, group: g },
        },
      ],
      winners: new Map(),
    })),
  };
  const progress = {
    resolve: vi.fn(
      async () =>
        new Map(g ? [[g.id, over.progress === undefined ? PROGRESS : over.progress]] : []),
    ),
  };
  const service = new PayTransferService({
    candidates,
    progress,
    gateway: { bankTransferInstructions: read },
  });
  return { service, read, candidates };
}

describe("PayTransferService", () => {
  it("gives a paying member the details the provider issued for the transfer", async () => {
    const { service, read } = setup();
    expect((await service.instructions(actor("finance"), [LOT]))._unsafeUnwrap()).toEqual({
      instructions: INSTRUCTIONS,
    });
    expect(read).toHaveBeenCalledWith("cs_1");
  });

  it("gives nothing to a member who does not pay for the account", async () => {
    const { service, read } = setup();
    expect((await service.instructions(actor("buyer_agent"), [LOT]))._unsafeUnwrapErr().code).toBe(
      "insufficient_entity_role",
    );
    expect(read).not.toHaveBeenCalled();
  });

  it("gives nothing for a lot that is not this account's purchase, or in no payment", async () => {
    const { service, read } = setup({ group: null });
    expect((await service.instructions(actor("finance"), [LOT]))._unsafeUnwrap()).toEqual({
      instructions: null,
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("gives nothing while the payer has not finished choosing the transfer", async () => {
    const { service, read } = setup({ progress: null });
    expect((await service.instructions(actor("finance"), [LOT]))._unsafeUnwrap()).toEqual({
      instructions: null,
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("gives nothing for a card payment", async () => {
    const { service, read } = setup({
      group: group({ checkoutRail: "card" }),
      progress: { ...PROGRESS, rail: "card", stage: "confirming" },
    });
    expect((await service.instructions(actor("finance"), [LOT]))._unsafeUnwrap()).toEqual({
      instructions: null,
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("answers null, never an error, when the provider cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { service } = setup({
      read: async () => {
        throw new Error("network");
      },
    });
    expect((await service.instructions(actor("finance"), [LOT]))._unsafeUnwrap()).toEqual({
      instructions: null,
    });
  });

  it("refuses a pick that is empty, too long or has a lot twice", async () => {
    const { service } = setup();
    expect((await service.instructions(actor("finance"), []))._unsafeUnwrapErr().code).toBe(
      "pay_several_empty",
    );
    expect((await service.instructions(actor("finance"), [LOT, LOT]))._unsafeUnwrapErr().code).toBe(
      "pay_several_duplicate",
    );
  });
});
