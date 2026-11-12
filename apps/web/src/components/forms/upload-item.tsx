"use client";

import type { UploadGalleryItem } from "@/lib/forms/image/use-upload-gallery";
import { Button } from "@auction/ui/components/button";
import { UploadProgress } from "@auction/ui/components/upload-progress";
import { cn } from "@auction/ui/lib/utils";

type Props = {
  item: UploadGalleryItem;
  onRetry?: (itemId: string) => void;
};

export function UploadItem({ item, onRetry }: Props) {
  const showProgress = item.status === "uploading" || item.status === "validating";
  return (
    <li
      className={cn(
        "rounded-md border bg-surface-container-low/50 px-3 py-2",
        item.status === "error" ? "border-error/50" : "border-outline-variant/25",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-body text-xs text-on-surface">{item.fileName}</span>
        <span
          className={cn(
            "font-body text-xs",
            item.status === "error" ? "font-medium text-error" : "text-on-surface-variant",
          )}
          role={item.status === "error" ? "alert" : undefined}
        >
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
      {item.status === "error" && item.retryable !== false && onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="default"
          className="mt-2 h-auto px-2 py-1 text-xs"
          onClick={() => onRetry(item.id)}
        >
          Retry upload
        </Button>
      ) : null}
    </li>
  );
}
