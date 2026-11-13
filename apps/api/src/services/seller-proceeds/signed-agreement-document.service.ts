import type {
  IStaffLotSellerProceedsReader,
  IUploadObjectDescriber,
  IUploadObjectReader,
} from "@auction/persistence/interfaces";
import type { IObjectStorage } from "../interfaces/object-storage.js";
import { SIGNED_AGREEMENT_UPLOAD_KIND } from "./record-signed-agreement.service.js";
import { SellerProceedsError } from "./seller-proceeds-errors.js";

/** A signed agreement link works for one minute: long enough to open, too short to pass around. */
export const SIGNED_AGREEMENT_LINK_SECONDS = 60;

export type SignedAgreementDocumentDeps = {
  reader: IStaffLotSellerProceedsReader;
  uploads: Pick<IUploadObjectReader, "findKey"> & IUploadObjectDescriber;
  storage: Pick<IObjectStorage, "createPresignedGet">;
};

const notFound = () =>
  new SellerProceedsError(
    "no_signed_document",
    404,
    "There is no signed agreement on record for this lot.",
  );

/**
 * A short-lived link to the signed PDF recorded with a lot's agreement, for staff who handle
 * agreements (the route checks who). Only the file the agreement points at, and only once the
 * upload has passed its checks (type and malware scan), is ever signed.
 */
export class SignedAgreementDocumentService {
  constructor(private readonly deps: SignedAgreementDocumentDeps) {}

  async linkFor(lotId: string): Promise<{ url: string; expiresInSeconds: number }> {
    const facts = await this.deps.reader.forLot(lotId);
    const documentId = facts?.agreement?.signedDocumentId ?? null;
    if (!documentId) throw notFound();
    const upload = await this.deps.uploads.describe(documentId);
    if (!upload || upload.kind !== SIGNED_AGREEMENT_UPLOAD_KIND || upload.status !== "active") {
      throw notFound();
    }
    const key = await this.deps.uploads.findKey(documentId);
    if (!key) throw notFound();
    const reference = facts?.agreement?.reference ?? "agreement";
    const { url } = await this.deps.storage.createPresignedGet({
      key,
      expiresInSec: SIGNED_AGREEMENT_LINK_SECONDS,
      responseContentType: "application/pdf",
      responseContentDisposition: `inline; filename="signed-agreement-${reference.replace(/[^A-Za-z0-9-]/g, "")}.pdf"`,
    });
    return { url, expiresInSeconds: SIGNED_AGREEMENT_LINK_SECONDS };
  }
}
