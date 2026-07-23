"use client";

import { CatalogOrderedImageCollection } from "@/components/admin/catalog/media";
import type { CatalogImageUploadKind } from "@/lib/upload/upload-policies.client";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  kind: CatalogImageUploadKind;
  /** Shown on thumbnails / placeholders */
  label: string;
  maxFiles?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  disabled?: boolean;
  previewUrlByKey?: Record<string, string>;
  showAddPanel?: boolean;
  onCloseAddPanel?: () => void;
  showManage?: boolean;
  inspectIndex?: number | null;
  onInspectIndex?: (index: number | null) => void;
};

/** @deprecated Prefer `CatalogOrderedImageCollection` directly. */
export function ImageGalleryManager({
  kind,
  label,
  value,
  onChange,
  maxFiles = 20,
  emptyTitle = "No images yet",
  emptyDescription = "Upload images, then drag to reorder. The first image is primary.",
  disabled = false,
  previewUrlByKey = {},
  showAddPanel = false,
  onCloseAddPanel,
  showManage = false,
  inspectIndex = null,
  onInspectIndex,
}: Props) {
  const primaryLabel = kind === "sale_cover" ? "Primary cover" : "Primary";

  return (
    <CatalogOrderedImageCollection
      kind={kind}
      value={value}
      onChange={onChange}
      maxFiles={maxFiles}
      disabled={disabled}
      previewUrlByKey={previewUrlByKey}
      imageLabel={label}
      primaryLabel={primaryLabel}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      showAddPanel={showAddPanel}
      {...(onCloseAddPanel ? { onCloseAddPanel } : {})}
      showManage={showManage}
      inspectIndex={inspectIndex}
      {...(onInspectIndex ? { onInspectIndex } : {})}
    />
  );
}
