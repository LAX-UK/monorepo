import type { StaffLotSellerProceedsFacts } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { SellerProceedsError } from "./seller-proceeds-errors.js";
import {
  SIGNED_AGREEMENT_LINK_SECONDS,
  SignedAgreementDocumentService,
} from "./signed-agreement-document.service.js";

const DOC = "6f1c2b0e-3a43-4d1b-9a7e-2f7d3c0d9b11";

function facts(signedDocumentId: string | null): StaffLotSellerProceedsFacts {
  return {
    lotId: "lot-1",
    lotNumber: 21,
    lotTitle: "The Lock Keeper's House",
    sellerLegalEntityId: "seller-1",
    sellerName: "Northbank Gallery Ltd",
    soldOnAtg: false,
    settledOutsideAt: null,
    sale: null,
    agreement: {
      id: "agr-1",
      submissionId: "sub-1",
      reference: "C-1042",
      legalEntityId: "seller-1",
      signedAt: new Date("2026-10-03T12:00:00Z"),
      commissionPercent: "12.00",
      source: "recorded",
      signedDocumentId,
      pricedOnEarlierVersion: false,
    },
    submissionId: "sub-1",
    vatSetting: "standard",
  };
}

function setup(
  lot: StaffLotSellerProceedsFacts | null,
  upload: { kind: string; status: string } | null = {
    kind: "signed_consignment_agreement",
    status: "active",
  },
) {
  const createPresignedGet = vi.fn().mockResolvedValue({ url: "https://files.test/signed?x=1" });
  const service = new SignedAgreementDocumentService({
    reader: { forLot: vi.fn().mockResolvedValue(lot) },
    uploads: {
      findKey: vi.fn().mockResolvedValue("uploads/consignment-agreements/a.pdf"),
      describe: vi
        .fn()
        .mockResolvedValue(
          upload && { ...upload, ownerUserId: "u", contentType: "application/pdf", byteSize: 1 },
        ),
    },
    storage: { createPresignedGet },
  });
  return { service, createPresignedGet };
}

describe("SignedAgreementDocumentService", () => {
  it("signs a one-minute link to the agreement's own PDF", async () => {
    const { service, createPresignedGet } = setup(facts(DOC));
    await expect(service.linkFor("lot-1")).resolves.toEqual({
      url: "https://files.test/signed?x=1",
      expiresInSeconds: 60,
    });
    expect(createPresignedGet).toHaveBeenCalledWith({
      key: "uploads/consignment-agreements/a.pdf",
      expiresInSec: SIGNED_AGREEMENT_LINK_SECONDS,
      responseContentType: "application/pdf",
      responseContentDisposition: 'inline; filename="signed-agreement-C-1042.pdf"',
    });
    expect(SIGNED_AGREEMENT_LINK_SECONDS).toBeLessThanOrEqual(60);
  });

  it.each<[string, StaffLotSellerProceedsFacts | null, { kind: string; status: string } | null]>([
    ["no lot", null, null],
    ["no PDF on the agreement", facts(null), null],
    [
      "a PDF still being checked",
      facts(DOC),
      { kind: "signed_consignment_agreement", status: "pending" },
    ],
    ["another kind of upload", facts(DOC), { kind: "lot_document", status: "active" }],
  ])("answers 404 and signs nothing for %s", async (_name, lot, upload) => {
    const { service, createPresignedGet } = setup(lot, upload);
    const error = await service.linkFor("lot-1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SellerProceedsError);
    expect((error as SellerProceedsError).status).toBe(404);
    expect(createPresignedGet).not.toHaveBeenCalled();
  });
});
