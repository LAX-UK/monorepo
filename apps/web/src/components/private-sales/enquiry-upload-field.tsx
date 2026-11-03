"use client";

import type { UploadItem } from "@/lib/private-sales/enquiry-uploads";
import { cn } from "@auction/ui";
import { Button, FilePickerButton } from "@auction/ui/lax";
import { CircleAlert, FileText, ImageIcon, Upload, X } from "lucide-react";
import { type DragEvent, useId, useState } from "react";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function Thumb({ item }: { item: UploadItem }) {
  const Icon = item.kind === "document" ? FileText : ImageIcon;
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lax-badge bg-lax-sunken text-lax-muted"
    >
      {item.previewUrl ? (
        <img src={item.previewUrl} alt="" className="size-full object-cover" />
      ) : (
        <Icon className="size-4" strokeWidth={1.75} />
      )}
    </span>
  );
}

function FileChip({ item, onRemove }: { item: UploadItem; onRemove: (id: string) => void }) {
  const rejected = item.state === "rejected";
  return (
    <li
      className={cn(
        "flex min-h-10 min-w-0 items-center gap-2 rounded-lax-control border py-1 pr-1 pl-1 text-lax-12 leading-4",
        rejected
          ? "border-lax-danger bg-lax-danger-bg text-lax-danger-fg"
          : "border-lax-line bg-lax-surface text-lax-fg",
      )}
    >
      {rejected ? (
        <CircleAlert aria-hidden className="mx-1.5 size-4 shrink-0" strokeWidth={1.75} />
      ) : (
        <Thumb item={item} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.name}</span>
        {rejected ? (
          <span className="block">{item.reason}</span>
        ) : item.state === "done" ? (
          <span className="block text-lax-muted">{sizeLabel(item.size)}</span>
        ) : (
          <span className="block text-lax-muted">
            <span className="sr-only">
              Uploading {item.name}, {Math.round(item.progress * 100)}%
            </span>
            <span
              aria-hidden
              className="mt-1 block h-1 w-24 overflow-hidden rounded-full bg-lax-line"
            >
              <span
                className="block h-full rounded-full bg-lax-ink transition-[width] duration-150 ease-out"
                style={{ width: `${Math.max(6, Math.round(item.progress * 100))}%` }}
              />
            </span>
          </span>
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`${item.state === "uploading" ? "Cancel" : "Remove"} ${item.name}`}
        onClick={() => onRemove(item.id)}
        className={rejected ? "hover:bg-lax-danger-bg" : undefined}
      >
        <X />
      </Button>
    </li>
  );
}

/**
 * The seller's photos and documents: a drop area with a button for the keyboard, then one row
 * per file with its progress, its thumbnail or its reason for being turned away. Files upload as
 * they are chosen; a refused file stays in the list and never stops the enquiry from being sent.
 */
export function EnquiryUploadField({
  items,
  onFiles,
  onRemove,
}: {
  items: readonly UploadItem[];
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const hintId = useId();
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files];
    if (files.length > 0) onFiles(files);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-1 rounded-lax-control border-[1.5px] border-dashed px-4 py-4 text-center text-lax-13 text-lax-muted transition-colors duration-150",
          dragging ? "border-lax-ink bg-lax-hover" : "border-lax-control-edge bg-lax-sunken",
        )}
      >
        <Upload aria-hidden className="size-[18px]" strokeWidth={1.75} />
        <p className="m-0">
          <FilePickerButton
            variant="secondary"
            size="sm"
            multiple
            accept={ACCEPT}
            onFiles={onFiles}
            aria-describedby={hintId}
          >
            Choose files
          </FilePickerButton>
        </p>
        <p className="m-0 text-lax-muted">or drop them here</p>
        <p id={hintId} className="m-0 text-lax-12">
          Up to 6 photos (JPEG, PNG, WebP, 10 MB each) and 2 PDFs (25 MB)
        </p>
      </div>
      {items.length > 0 ? (
        <ul aria-label="Files added" className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {items.map((item) => (
            <FileChip key={item.id} item={item} onRemove={onRemove} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
