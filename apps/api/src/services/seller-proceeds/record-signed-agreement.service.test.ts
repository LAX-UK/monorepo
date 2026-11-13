import type { SellerTermsSnapshot } from "@auction/domain";
import {
  AgreementAlreadyRecordedError,
  type LockedAgreement,
  type RecordedAgreement,
  SignedDocumentInUseError,
  type StaffLotSellerProceedsFacts,
  type UploadObjectDescription,
} from "@auction/persistence/interfaces";
import { SIGNED_AGREEMENT_MESSAGES } from "@auction/validators";
import { describe, expect, it, vi } from "vitest";
import {
  type RecordSignedAgreementCommand,
  RecordSignedAgreementService,
  SIGNED_AGREEMENT_DOCUMENT_IN_USE,
} from "./record-signed-agreement.service.js";
import { SellerProceedsError } from "./seller-proceeds-errors.js";

const LOT = "0d6f1f8e-6a55-4c11-9c76-0d1c1e7b2a01";
const SELLER = "7b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const SUBMISSION = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";
const UPLOAD = "6f1c2b0e-3a43-4d1b-9a7e-2f7d3c0d9b11";
const TERMS = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const AGREEMENT = "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b";
const STAFF = "staff-user-1";

function heldFacts(over: Partial<StaffLotSellerProceedsFacts> = {}): StaffLotSellerProceedsFacts {
  return {
    lotId: LOT,
    lotNumber: 21,
    lotTitle: "The Lock Keeper's House",
    sellerLegalEntityId: SELLER,
    sellerName: "Northbank Gallery Ltd",
    soldOnAtg: false,
    settledOutsideAt: null,
    sale: {
      paymentId: "pay-1",
      paymentStatus: "captured",
      terms: {
        id: TERMS,
        basis: "held",
        heldReason: "no_agreement",
        source: "raised",
        hammerPence: 620_000,
        premiumPence: 155_000,
        commissionBps: null,
        commissionPence: null,
        commissionVatTreatment: null,
        commissionVatBps: null,
        commissionVatPence: null,
        sellerNetPence: null,
        legacyPlatformFeePence: null,
        computedAt: new Date("2026-11-12T10:00:00Z"),
      },
      invoice: { totalPence: 775_000, premiumPence: 155_000, premiumRatePercent: "25.000" },
      payout: null,
      refundedAfterPayout: false,
      reawarded: false,
    },
    agreement: null,
    submissionId: SUBMISSION,
    vatSetting: "standard",
    ...over,
  };
}

const pdf: UploadObjectDescription = {
  status: "active",
  kind: "signed_consignment_agreement",
  ownerUserId: STAFF,
  contentType: "application/pdf",
  byteSize: 1_200_000,
};

const command: RecordSignedAgreementCommand = {
  lotId: LOT,
  commissionPercent: "12",
  signedOn: "2026-10-03",
  uploadObjectId: UPLOAD,
  reason: "Signed on paper at the gallery",
  replace: false,
  actor: { userId: STAFF, isAdministrator: false },
};

/** The agreement row as the writer reads it under its lock, from the facts' agreement. */
function lockedRowOf(facts: StaffLotSellerProceedsFacts | null): LockedAgreement | null {
  const a = facts?.agreement;
  return a
    ? {
        id: a.id,
        legalEntityId: a.legalEntityId,
        commissionPercent: a.commissionPercent,
        acceptedAt: a.signedAt,
      }
    : null;
}

function setup(
  facts: StaffLotSellerProceedsFacts | null = heldFacts(),
  upload = pdf,
  inTx: {
    /** The lot as read inside the transaction, after the lock; the same as before by default. */
    facts?: StaffLotSellerProceedsFacts | null;
    /** The agreement row under its lock; the facts' agreement by default. */
    agreement?: LockedAgreement | null;
  } = {},
) {
  const order: string[] = [];
  const recordSigned = vi.fn(async () => {
    order.push("recordSigned");
    return { agreementId: AGREEMENT, replaced: null } as RecordedAgreement;
  });
  const repriceHeld = vi.fn(async (id: string, snapshot: SellerTermsSnapshot) => {
    order.push("repriceHeld");
    return { id, snapshot };
  });
  const factsInTx = inTx.facts === undefined ? facts : inTx.facts;
  const agreementInTx = inTx.agreement === undefined ? lockedRowOf(factsInTx) : inTx.agreement;
  const agreements = {
    lockSettlement: vi.fn(async (id: string) => {
      order.push(`lockSettlement:${id}`);
    }),
    lockSale: vi.fn(async (sale: { paymentId: string; sellerTermsId: string | null }) => {
      order.push(`lockSale:${sale.paymentId}:${sale.sellerTermsId}`);
    }),
    lockAgreement: vi.fn(async () => {
      order.push("lockAgreement");
      return agreementInTx;
    }),
    claimDocument: vi.fn(async () => {
      order.push("claimDocument");
    }),
    recordSigned,
  };
  const publish = vi.fn().mockResolvedValue(undefined);
  const factsReadInTx = vi.fn(async () => {
    order.push("readFacts");
    return factsInTx;
  });
  const service = new RecordSignedAgreementService({
    reader: { forLot: vi.fn().mockResolvedValue(facts) },
    uploads: { describe: vi.fn().mockResolvedValue(upload) },
    unitOfWork: (work) =>
      work({
        facts: { forLot: factsReadInTx },
        agreements,
        sellerTerms: { repriceHeld },
        events: { publish },
      }),
    today: () => "2026-11-13",
  });
  return { service, recordSigned, repriceHeld, publish, agreements, order };
}

async function refusal(promise: Promise<unknown>): Promise<SellerProceedsError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(SellerProceedsError);
  return error as SellerProceedsError;
}

describe("RecordSignedAgreementService", () => {
  it("records the agreement, prices the held sale with the calculator and writes the audit entry", async () => {
    const { service, recordSigned, repriceHeld, publish } = setup();
    const result = await service.record(command);

    expect(recordSigned).toHaveBeenCalledWith({
      submissionId: SUBMISSION,
      legalEntityId: SELLER,
      commissionPercent: "12.00",
      signedAt: new Date("2026-10-03T12:00:00Z"),
      signedDocumentId: UPLOAD,
      reason: "Signed on paper at the gallery",
      recordedByUserId: STAFF,
    });
    // £6,200 at 12% is £744; 20% VAT on that is £148.80; the seller receives £5,307.20.
    expect(repriceHeld).toHaveBeenCalledWith(
      TERMS,
      expect.objectContaining({
        basis: "agreement",
        agreementId: AGREEMENT,
        commissionBps: 1200,
        commissionPence: 74_400,
        commissionVatPence: 14_880,
        sellerNetPence: 530_720,
      }),
      "agreement_recorded",
    );
    expect(result).toEqual({
      agreementId: AGREEMENT,
      releasedSellerTermsId: TERMS,
      sellerNetPence: 530_720,
      sale: { kind: "released", sellerTermsId: TERMS, sellerNetPence: 530_720 },
    });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "lot",
        aggregateId: LOT,
        eventType: "lot.seller_agreement_recorded",
        actorUserId: STAFF,
        payload: expect.objectContaining({
          commissionPercent: "12.00",
          signedDocumentId: UPLOAD,
          reason: "Signed on paper at the gallery",
          replace: false,
          previousAgreement: null,
          saleOutcome: "released",
          heldReason: null,
          sellerNetPence: 530_720,
        }),
      }),
    );
  });

  it("refuses with every field's message and writes nothing", async () => {
    const { service, recordSigned, publish } = setup();
    const error = await refusal(
      service.record({
        ...command,
        commissionPercent: "",
        signedOn: "",
        uploadObjectId: null,
        reason: "short",
      }),
    );
    expect(error.status).toBe(422);
    expect(error.fields).toEqual(SIGNED_AGREEMENT_MESSAGES);
    expect(recordSigned).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it.each<[string, Partial<UploadObjectDescription>]>([
    ["another kind of upload", { kind: "lot_document" }],
    ["someone else's upload", { ownerUserId: "someone-else" }],
    ["a file that is not a PDF", { contentType: "image/png" }],
    ["a PDF over 20 MB", { byteSize: 20 * 1024 * 1024 + 1 }],
  ])("refuses %s as the signed agreement", async (_name, over) => {
    const { service, recordSigned } = setup(heldFacts(), { ...pdf, ...over });
    const error = await refusal(service.record(command));
    expect(error.status).toBe(422);
    expect(error.fields).toEqual({ document: SIGNED_AGREEMENT_MESSAGES.document });
    expect(recordSigned).not.toHaveBeenCalled();
  });

  it("asks to wait while the PDF is still being checked", async () => {
    const { service } = setup(heldFacts(), { ...pdf, status: "pending" });
    expect((await refusal(service.record(command))).code).toBe("document_not_ready");
  });

  it("refuses a lot with no consignment to keep the agreement with", async () => {
    const { service } = setup(heldFacts({ submissionId: null }));
    expect((await refusal(service.record(command))).code).toBe("no_consignment");
  });

  it("answers not found for a lot that does not exist", async () => {
    const { service } = setup(null);
    expect((await refusal(service.record(command))).status).toBe(404);
  });

  describe("with a sound agreement already on record", () => {
    const onRecord = heldFacts({
      agreement: {
        id: AGREEMENT,
        submissionId: SUBMISSION,
        reference: "C-1042",
        legalEntityId: SELLER,
        signedAt: new Date("2026-10-03T10:00:00Z"),
        commissionPercent: "15.00",
        source: "online",
      },
    });

    it("refuses to record over it by accident", async () => {
      const { service } = setup(onRecord);
      expect((await refusal(service.record(command))).code).toBe("agreement_on_record");
    });

    it("lets only an Administrator replace it", async () => {
      const { service } = setup(onRecord);
      const error = await refusal(service.record({ ...command, replace: true }));
      expect(error.status).toBe(403);
      expect(error.code).toBe("replace_needs_administrator");
    });

    it("replaces it for an Administrator and keeps what it replaced in the audit entry", async () => {
      const { service, recordSigned, publish } = setup(onRecord);
      recordSigned.mockResolvedValue({
        agreementId: AGREEMENT,
        replaced: {
          id: AGREEMENT,
          legalEntityId: SELLER,
          commissionPercent: "15.00",
          acceptedAt: new Date("2026-10-03T10:00:00Z"),
          source: "online",
          signedDocumentId: null,
        },
      });
      await service.record({
        ...command,
        replace: true,
        actor: { userId: STAFF, isAdministrator: true },
      });
      expect(publish.mock.calls[0]?.[0].payload).toMatchObject({
        replace: true,
        previousAgreement: { commissionPercent: "15.00", source: "online" },
      });
    });
  });

  it("records an agreement for the seller when the one on record is another account's", async () => {
    const { service, recordSigned } = setup(
      heldFacts({
        agreement: {
          id: AGREEMENT,
          submissionId: SUBMISSION,
          reference: "C-1042",
          legalEntityId: "another-account",
          signedAt: new Date("2026-10-03T10:00:00Z"),
          commissionPercent: "15.00",
          source: "online",
        },
      }),
    );
    await service.record(command);
    expect(recordSigned).toHaveBeenCalledWith(expect.objectContaining({ legalEntityId: SELLER }));
  });

  it("keeps the sale held when the VAT setting is still missing", async () => {
    const { service, repriceHeld } = setup(heldFacts({ vatSetting: null }));
    const result = await service.record(command);
    expect(repriceHeld.mock.calls[0]?.[1]).toMatchObject({
      basis: "held",
      heldReason: "vat_setting_missing",
    });
    expect(result.releasedSellerTermsId).toBeNull();
    expect(result.sale).toEqual({ kind: "still_held", reason: "vat_setting_missing" });
  });

  describe("decides under the run's locks, in the run's order", () => {
    it("takes the seller's settlement lock, then the payment and its terms, then the agreement row, before deciding", async () => {
      const { service, order } = setup();
      await service.record(command);
      expect(order).toEqual([
        `lockSettlement:${SELLER}`,
        "readFacts",
        `lockSale:pay-1:${TERMS}`,
        "lockAgreement",
        "claimDocument",
        "readFacts",
        "recordSigned",
        "repriceHeld",
      ]);
    });

    it("refuses a second, non-Administrator submission once the first has recorded the agreement (double submit)", async () => {
      // Both submissions read the lot before either committed: no agreement. The second one
      // reaches the agreement row after the first committed, and finds it recorded.
      const { service, recordSigned, publish } = setup(heldFacts(), pdf, {
        agreement: {
          id: AGREEMENT,
          legalEntityId: SELLER,
          commissionPercent: "12.00",
          acceptedAt: new Date("2026-10-03T12:00:00Z"),
        },
      });
      const error = await refusal(service.record(command));
      expect(error.status).toBe(409);
      expect(error.code).toBe("agreement_on_record");
      expect(recordSigned).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it("still asks for an Administrator to replace when the agreement appeared after the first read", async () => {
      const { service, recordSigned } = setup(heldFacts(), pdf, {
        agreement: {
          id: AGREEMENT,
          legalEntityId: SELLER,
          commissionPercent: "12.00",
          acceptedAt: new Date("2026-10-03T12:00:00Z"),
        },
      });
      const error = await refusal(service.record({ ...command, replace: true }));
      expect(error.code).toBe("replace_needs_administrator");
      expect(recordSigned).not.toHaveBeenCalled();
    });

    it("maps a concurrent insert that lost the unique index to 409, not a 500", async () => {
      const { service, recordSigned } = setup();
      recordSigned.mockRejectedValueOnce(new AgreementAlreadyRecordedError());
      const error = await refusal(service.record(command));
      expect(error.status).toBe(409);
      expect(error.code).toBe("agreement_on_record");
    });

    it("says the sale was already paid, not released, when a run paid it before the locks were taken", async () => {
      const paid = heldFacts();
      const sale = paid.sale as NonNullable<StaffLotSellerProceedsFacts["sale"]>;
      const afterRun = heldFacts({
        sale: {
          ...sale,
          terms: { ...(sale.terms as NonNullable<typeof sale.terms>), basis: "agreement" },
          payout: { id: "po-1", status: "scheduled", processedAt: null },
        },
      });
      const { service, repriceHeld, publish } = setup(paid, pdf, { facts: afterRun });
      const result = await service.record(command);
      expect(repriceHeld).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        releasedSellerTermsId: null,
        sellerNetPence: null,
        sale: { kind: "already_paid" },
      });
      expect(publish.mock.calls[0]?.[0].payload).toMatchObject({
        saleOutcome: "already_paid",
        releasedSellerTermsId: null,
        sellerNetPence: null,
      });
    });

    it("reports a held sale the store would not reprice (priced meanwhile) as already priced", async () => {
      const { service, repriceHeld, publish } = setup();
      repriceHeld.mockImplementationOnce(async (id: string) => ({
        id,
        snapshot: { basis: "lax_owned" } as SellerTermsSnapshot,
      }));
      const result = await service.record(command);
      expect(result.sale).toEqual({ kind: "already_priced" });
      expect(publish.mock.calls[0]?.[0].payload).toMatchObject({
        saleOutcome: "already_priced",
        releasedSellerTermsId: null,
      });
    });

    it("refuses when the lot's seller changed between the first read and the lock", async () => {
      const { service, recordSigned } = setup(heldFacts(), pdf, {
        facts: heldFacts({ sellerLegalEntityId: "another-seller" }),
      });
      const error = await refusal(service.record(command));
      expect(error.code).toBe("lot_changed");
      expect(recordSigned).not.toHaveBeenCalled();
    });

    it("refuses a PDF already used for another consignment's agreement", async () => {
      const { service, agreements, recordSigned } = setup();
      agreements.claimDocument.mockRejectedValueOnce(new SignedDocumentInUseError());
      const error = await refusal(service.record(command));
      expect(error.status).toBe(422);
      expect(error.fields).toEqual({ document: SIGNED_AGREEMENT_DOCUMENT_IN_USE });
      expect(recordSigned).not.toHaveBeenCalled();
    });
  });
});
