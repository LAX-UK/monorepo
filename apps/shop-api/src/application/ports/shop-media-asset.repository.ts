import type { ShopMediaKind } from "../../domain/shop-media-upload-policy.js";

export type ShopMediaAssetStatus = "pending" | "active" | "rejected";

export type ShopMediaAssetRow = {
  key: string;
  kind: ShopMediaKind;
  status: ShopMediaAssetStatus;
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
  alt: string | null;
  createdBySubjectId: string | null;
};

export type ShopMediaAssetRepository = {
  insertPending(row: {
    key: string;
    kind: ShopMediaKind;
    contentType: string;
    byteSize: number;
    createdBySubjectId: string | null;
  }): Promise<void>;
  markActive(row: {
    key: string;
    width: number;
    height: number;
    blurDataUrl: string;
    alt: string | null;
  }): Promise<void>;
  markRejected(key: string): Promise<void>;
  findByKey(key: string): Promise<ShopMediaAssetRow | null>;
};
