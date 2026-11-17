import { randomUUID } from "node:crypto";
import type { ObjectStoragePort } from "@auction/object-storage";
import {
  CONSIGNOR_AGREEMENT_FILE_MAX_BYTES,
  CONSIGNOR_AGREEMENT_FILE_TYPES,
} from "@auction/shop-contracts";
import type { ConsignorAgreementFiles } from "../application/ports/consignor-agreement.ports.js";

/** Signed links last minutes: long enough to send or open the file, never stored. */
export const AGREEMENT_FILE_LINK_SECONDS = 300;

const EXTENSIONS: Record<(typeof CONSIGNOR_AGREEMENT_FILE_TYPES)[number], string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * Each client's signed agreements, under a prefix of their own. It is outside `shop/*`, the only
 * part of the bucket that is public, so a file is reached only through a signed link.
 */
export const agreementFilePrefix = (partyId: string) => `private/consignor-agreements/${partyId}/`;

const isAllowedType = (type: string): type is (typeof CONSIGNOR_AGREEMENT_FILE_TYPES)[number] =>
  (CONSIGNOR_AGREEMENT_FILE_TYPES as readonly string[]).includes(type);

/** Whether the first bytes are what the stored type says: a PDF, a JPEG or a PNG. */
export function matchesAgreementFileType(contentType: string, bytes: Buffer): boolean {
  if (contentType === "application/pdf") return bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  if (contentType === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") {
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return false;
}

/** Signed agreements in the shop's object storage, uploaded and opened through signed links. */
export function createConsignorAgreementFiles(
  storage: Pick<
    ObjectStoragePort,
    "createPresignedPut" | "createPresignedGet" | "headObject" | "getObjectBytes"
  >,
  now: () => Date = () => new Date(),
): ConsignorAgreementFiles {
  return {
    async createUpload({ partyId, contentType, byteSize }) {
      if (!isAllowedType(contentType))
        throw new Error(`Unsupported agreement file type ${contentType}`);
      const key = `${agreementFilePrefix(partyId)}${randomUUID()}.${EXTENSIONS[contentType]}`;
      const signed = await storage.createPresignedPut({
        key,
        contentType,
        byteSize,
        expiresInSec: AGREEMENT_FILE_LINK_SECONDS,
      });
      return { key, uploadUrl: signed.url, requiredHeaders: signed.requiredHeaders };
    },

    async check({ partyId, key }) {
      if (!key.startsWith(agreementFilePrefix(partyId)))
        return { ok: false, reason: "not_this_client" };
      const head = await storage.headObject(key);
      if (!head || head.byteSize <= 0) return { ok: false, reason: "missing" };
      if (head.byteSize > CONSIGNOR_AGREEMENT_FILE_MAX_BYTES)
        return { ok: false, reason: "too_large" };
      if (!isAllowedType(head.contentType)) return { ok: false, reason: "wrong_type" };
      const first = await storage.getObjectBytes(key, 16);
      if (!first || !matchesAgreementFileType(head.contentType, first)) {
        return { ok: false, reason: "wrong_type" };
      }
      return { ok: true };
    },

    async downloadLink({ key, fileName }) {
      const safeName = fileName.replace(/[^\w.\- ]+/g, "_");
      const { url } = await storage.createPresignedGet({
        key,
        expiresInSec: AGREEMENT_FILE_LINK_SECONDS,
        responseContentDisposition: `attachment; filename="${safeName}"`,
      });
      return { url, expiresAt: new Date(now().getTime() + AGREEMENT_FILE_LINK_SECONDS * 1000) };
    },
  };
}
