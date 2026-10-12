import type { ShopMediaAssetRepository } from "../application/ports/shop-media-asset.repository.js";
import type { ShopMediaKind } from "../domain/shop-media-upload-policy.js";

type Row = {
  key: string;
  kind: ShopMediaKind;
  status: "pending" | "active" | "rejected";
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
  alt: string | null;
  createdBySubjectId: string | null;
};

export function createMemoryShopMediaAssetRepository(): ShopMediaAssetRepository & {
  rows: Map<string, Row>;
} {
  const rows = new Map<string, Row>();
  return {
    rows,
    async insertPending(row) {
      rows.set(row.key, {
        ...row,
        status: "pending",
        width: null,
        height: null,
        blurDataUrl: null,
        alt: null,
      });
    },
    async markActive(row) {
      const existing = rows.get(row.key);
      if (!existing) throw new Error("missing");
      rows.set(row.key, {
        ...existing,
        status: "active",
        width: row.width,
        height: row.height,
        blurDataUrl: row.blurDataUrl,
        alt: row.alt,
      });
    },
    async markRejected(key) {
      const existing = rows.get(key);
      if (existing) rows.set(key, { ...existing, status: "rejected" });
    },
    async findByKey(key) {
      return rows.get(key) ?? null;
    },
  };
}
