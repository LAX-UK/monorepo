"use client";

import type { UploadGalleryItem } from "@/lib/forms/image/use-upload-gallery";
import { Button } from "@auction/ui/components/button";
import { UploadProgress } from "@auction/ui/components/upload-progress";

type Props = {
  item: UploadGalleryItem;
  onRetry?: (fileName: string) => void;
};

export function UploadItem({ item, onRetry }: Props) {
  const showProgress = item.status === "uploading" || item.status === "validating";
  return (
    <li className="rounded-md border border-outline-variant/25 bg-surface-container-low/50 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-body text-xs text-on-surface">{item.fileName}</span>
        <span className="font-body text-xs text-on-surface-variant">
          {item.message ?? item.status}
        </span>
      </div>
      {showProgress && item.progress != null ? (
        <UploadProgress
          className="mt-2"
          value={item.progress}
          label={`Uploading ${item.fileName}`}
        />
      ) : null}
      {item.status === "error" && onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-auto px-2 py-1 text-xs"
          onClick={() => onRetry(item.fileName)}
        >
          Retry upload
        </Button>
      ) : null}
    </li>
  );
}
