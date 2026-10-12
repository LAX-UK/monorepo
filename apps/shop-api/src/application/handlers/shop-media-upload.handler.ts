import type { ObjectStoragePort } from "@auction/object-storage";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  SHOP_MEDIA_PRESIGN_TTL_SEC,
  type ShopMediaKind,
  buildShopMediaObjectKey,
  matchesDeclaredImageType,
  shopMediaPolicy,
} from "../../domain/shop-media-upload-policy.js";
import { ShopApiError } from "../../errors/shop-api-error.js";
import type { ImageProbePort } from "../ports/image-probe.port.js";
import type { ShopMediaAssetRepository } from "../ports/shop-media-asset.repository.js";

const MAGIC_BYTE_READ = 16;

export type ShopMediaUploadHandlers = {
  presign(input: {
    kind: ShopMediaKind;
    contentType: string;
    byteSize: number;
    subjectId: string;
  }): Promise<{
    key: string;
    uploadUrl: string;
    publicUrl: string;
    requiredHeaders: Record<string, string>;
  }>;
  confirm(input: { key: string; alt: string | null }): Promise<{
    key: string;
    publicUrl: string;
    width: number;
    height: number;
    blurDataUrl: string;
    alt: string | null;
  }>;
};

function assertPresignInput(kind: ShopMediaKind, contentType: string, byteSize: number): void {
  const policy = shopMediaPolicy(kind);
  if (!Number.isInteger(byteSize) || byteSize <= 0) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      "byteSize must be a positive integer",
      400,
    );
  }
  if (byteSize > policy.maxBytes) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      `Upload exceeds maximum size of ${policy.maxBytes} bytes`,
      400,
    );
  }
  if (!policy.allowedContentTypes.includes(contentType)) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Unsupported content type", 400);
  }
}

export function createShopMediaUploadHandlers(deps: {
  storage: ObjectStoragePort;
  repository: ShopMediaAssetRepository;
  imageProbe: ImageProbePort;
}): ShopMediaUploadHandlers {
  const { storage, repository, imageProbe } = deps;

  /** Rejected uploads must not stay readable on the public media host. */
  async function reject(key: string, message: string): Promise<never> {
    await repository.markRejected(key);
    await storage.deleteObject(key).catch(() => undefined);
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, message, 400);
  }

  return {
    async presign(input) {
      assertPresignInput(input.kind, input.contentType, input.byteSize);
      const key = buildShopMediaObjectKey(input.kind, input.contentType);
      await repository.insertPending({
        key,
        kind: input.kind,
        contentType: input.contentType,
        byteSize: input.byteSize,
        createdBySubjectId: input.subjectId,
      });
      const signed = await storage.createPresignedPut({
        key,
        contentType: input.contentType,
        byteSize: input.byteSize,
        expiresInSec: SHOP_MEDIA_PRESIGN_TTL_SEC,
      });
      return {
        key,
        uploadUrl: signed.url,
        publicUrl: storage.getPublicUrl(key),
        requiredHeaders: signed.requiredHeaders,
      };
    },

    async confirm(input) {
      const key = input.key.trim().replace(/^\/+/, "");
      if (!key) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "key is required", 400);
      }

      const row = await repository.findByKey(key);
      if (!row) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Media asset not found", 404);
      }
      if (row.status !== "pending") {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.CONFLICT,
          `Media asset is already ${row.status}`,
          409,
        );
      }

      const policy = shopMediaPolicy(row.kind);
      const head = await storage.headObject(key);
      if (!head || head.byteSize <= 0) {
        return reject(key, "Uploaded object is missing");
      }
      if (head.byteSize > policy.maxBytes) {
        return reject(key, "Uploaded object exceeds size limit");
      }
      if (head.byteSize !== row.byteSize) {
        return reject(key, "Uploaded object size does not match declared byteSize");
      }
      if (head.contentType !== row.contentType) {
        return reject(key, "Uploaded object content type does not match the presigned type");
      }

      const magicBytes = await storage.getObjectBytes(key, MAGIC_BYTE_READ);
      if (!magicBytes || !matchesDeclaredImageType(row.contentType, magicBytes)) {
        return reject(key, "File content does not match content type");
      }

      const buffer = await storage.getObjectBytes(key, head.byteSize);
      if (!buffer || buffer.byteLength === 0) {
        return reject(key, "Uploaded object is empty");
      }

      let width: number;
      let height: number;
      let blurDataUrl: string;
      try {
        const dimensions = await imageProbe.analyze(buffer);
        width = dimensions.width;
        height = dimensions.height;
        blurDataUrl = await imageProbe.makeLqip(buffer);
      } catch {
        return reject(key, "Image could not be processed");
      }

      const alt = input.alt?.trim() ? input.alt.trim().slice(0, 500) : null;
      await repository.markActive({ key, width, height, blurDataUrl, alt });
      return {
        key,
        publicUrl: storage.getPublicUrl(key),
        width,
        height,
        blurDataUrl,
        alt,
      };
    },
  };
}
