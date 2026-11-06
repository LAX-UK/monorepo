import { describe, expect, it, vi } from "vitest";
import { type KycDecisionApplyInput, KycDecisionProcessor } from "./kyc-decision-processor.js";

const EMPTY_FIELDS = {
  verifiedFirstName: null,
  verifiedLastName: null,
  verifiedDateOfBirth: null,
  verifiedIdNumberLast4: null,
  verifiedIdCountry: null,
  verifiedIdType: null,
  verifiedIdExpiry: null,
  verifiedGender: null,
  verifiedNationality: null,
  verifiedCitizenship: null,
  verifiedPlaceOfBirth: null,
  verifiedYearOfBirth: null,
  verifiedIdNumber: null,
  verifiedDocState: null,
  verifiedIdValidFrom: null,
  decisionRiskScore: null,
  decisionIpCountry: null,
};

function input(over: Partial<KycDecisionApplyInput>): KycDecisionApplyInput {
  return {
    providerSessionId: "sess-1",
    providerAttemptId: "att-1",
    verificationStatus: "verified",
    userKycUpdate: { setStatus: "approved", verifiedAt: new Date(), incrementRetry: false },
    verifiedFields: EMPTY_FIELDS,
    decisionPayload: {},
    decisionAt: new Date(),
    isApproved: true,
    ...over,
  };
}

function processor(
  opts: {
    userKycStatus?: string;
    identityHeldSince?: Date | null;
    currentSession?: string;
    invoiceTerms?: { extendOpenInvoices: ReturnType<typeof vi.fn> };
  } = {},
) {
  const existing = {
    id: "v1",
    userId: "u1",
    providerSessionId: "sess-1",
    status: "created",
    createdAt: new Date("2026-11-01T09:00:00Z"),
  };
  const repo = {
    findByProviderSessionId: vi.fn().mockResolvedValue(existing),
    getUserKycState: vi.fn().mockResolvedValue({
      kycStatus: opts.userKycStatus ?? "pending",
      identityHeldSince: opts.identityHeldSince ?? null,
    }),
    getDecisionPayload: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue(existing),
    getUserKycWebhookState: vi
      .fn()
      .mockResolvedValue({ currentKycSessionId: opts.currentSession ?? "sess-1" }),
    setUserKycStatus: vi.fn().mockResolvedValue(undefined),
    incrementUserKycRetryCount: vi.fn().mockResolvedValue(undefined),
  };
  return new KycDecisionProcessor(repo as never, null, (opts.invoiceTerms as never) ?? null);
}

const DECLINED = input({
  verificationStatus: "canceled",
  userKycUpdate: { setStatus: "rejected", verifiedAt: null, incrementRetry: false },
  isApproved: false,
});

describe("KycDecisionProcessor outcome notice", () => {
  it("asks to tell the person when their check is approved", async () => {
    const result = await processor().apply(input({}), null);
    expect(result.outcomeNotify).toEqual({
      userId: "u1",
      outcome: "approved",
      providerSessionId: "sess-1",
      providerAttemptId: "att-1",
    });
  });

  it("asks to tell the person when their check is declined", async () => {
    const result = await processor().apply(DECLINED, null);
    expect(result.outcomeNotify).toMatchObject({ userId: "u1", outcome: "declined" });
  });

  it("says nothing for an outcome that is not final: more information, expired, abandoned", async () => {
    for (const userKycUpdate of [
      { setStatus: "pending" as const, verifiedAt: null, incrementRetry: false },
      { setStatus: "unverified" as const, verifiedAt: null, incrementRetry: false },
    ]) {
      const result = await processor().apply(
        input({ verificationStatus: "requires_input", userKycUpdate, isApproved: false }),
        null,
      );
      expect(result.outcomeNotify).toBeUndefined();
    }
  });

  it("says nothing when the person is already verified", async () => {
    const approved = processor({ userKycStatus: "approved" });
    expect((await approved.apply(input({}), null)).outcomeNotify).toBeUndefined();
    expect((await approved.apply(DECLINED, null)).outcomeNotify).toBeUndefined();
  });

  it("says nothing for an older session that is no longer the person's current check", async () => {
    const result = await processor({ currentSession: "sess-2" }).apply(input({}), null);
    expect(result.outcomeNotify).toBeUndefined();
  });
});

describe("KycDecisionProcessor invoice terms", () => {
  const CONN = { marker: "tx" } as never;
  const terms = () => ({ extendOpenInvoices: vi.fn().mockResolvedValue(1) });

  it("moves the due dates of a personal buyer's unpaid invoices when their identity is verified", async () => {
    const invoiceTerms = terms();
    await processor({ invoiceTerms }).apply(input({}), CONN);
    expect(invoiceTerms.extendOpenInvoices).toHaveBeenCalledTimes(1);
    expect(invoiceTerms.extendOpenInvoices).toHaveBeenCalledWith(
      {
        kind: "winner",
        userId: "u1",
        personalAccountsOnly: true,
        // Never approved before: held from the start, so every unpaid invoice moves.
        holdStartedAt: new Date(0),
      },
      expect.any(Date),
      CONN,
    );
  });

  it("holds from the moment an approved identity was lost, not from the session, when it is approved again", async () => {
    const lostAt = new Date("2026-09-15T08:00:00Z");
    const invoiceTerms = terms();
    await processor({ userKycStatus: "rejected", identityHeldSince: lostAt, invoiceTerms }).apply(
      input({}),
      CONN,
    );
    expect(invoiceTerms.extendOpenInvoices.mock.calls[0]?.[0]).toMatchObject({
      holdStartedAt: lostAt,
    });
  });

  it("leaves them alone when the person was already verified, so a repeat changes nothing", async () => {
    const invoiceTerms = terms();
    await processor({ userKycStatus: "approved", invoiceTerms }).apply(input({}), CONN);
    expect(invoiceTerms.extendOpenInvoices).not.toHaveBeenCalled();
  });

  it("leaves them alone for a declined or unfinished check", async () => {
    const invoiceTerms = terms();
    await processor({ invoiceTerms }).apply(DECLINED, CONN);
    await processor({ invoiceTerms }).apply(
      input({
        verificationStatus: "requires_input",
        userKycUpdate: { setStatus: "pending", verifiedAt: null, incrementRetry: false },
        isApproved: false,
      }),
      CONN,
    );
    expect(invoiceTerms.extendOpenInvoices).not.toHaveBeenCalled();
  });

  it("leaves them alone for an older session that is no longer the person's current check", async () => {
    const invoiceTerms = terms();
    await processor({ currentSession: "sess-2", invoiceTerms }).apply(input({}), CONN);
    expect(invoiceTerms.extendOpenInvoices).not.toHaveBeenCalled();
  });
});
