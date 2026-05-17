"use client";

import type { UploadGalleryItem } from "@/lib/forms/image/use-upload-gallery";
import { Button } from "@auction/ui/components/button";

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
        <progress
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-outline-variant/30 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-outline-variant/30 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary"
          value={item.progress}
          max={100}
          aria-label={`Uploading ${item.fileName}`}
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
