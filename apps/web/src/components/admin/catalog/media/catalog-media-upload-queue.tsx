"use client";

import { UploadItem } from "@/components/forms/upload-item";
import type { UploadGalleryItem } from "@/lib/forms/image/use-upload-gallery";

type Props = {
  items: UploadGalleryItem[];
  disabled?: boolean;
  onRetry?: (itemId: string) => void;
};

/** Shared aria-live upload progress list for catalog media surfaces. */
export function CatalogMediaUploadQueue({ items, disabled = false, onRetry }: Props) {
  if (items.length === 0) return null;

  return (
    <ul className="space-y-2" aria-live="polite">
      {items.map((item) => (
        <UploadItem
          key={item.id}
          item={item}
          {...(disabled || !onRetry ? {} : { onRetry: (itemId: string) => void onRetry(itemId) })}
        />
      ))}
    </ul>
  );
}
