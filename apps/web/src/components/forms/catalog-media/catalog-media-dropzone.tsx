"use client";

import { FileUploadTrigger } from "@auction/ui/components/file-upload-trigger";
import { ImagePlus } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  inputId: string;
  title: string;
  description: string;
  accept: string;
  onFilesSelected: (files: FileList) => void;
  multiple?: boolean;
  disabled?: boolean;
  busy?: boolean;
  compact?: boolean;
  queue?: ReactNode;
  mobileActions?: ReactNode;
};

/** Shared catalogue dropzone with consistent constraints and upload feedback placement. */
export function CatalogMediaDropzone({
  inputId,
  title,
  description,
  accept,
  onFilesSelected,
  multiple = true,
  disabled = false,
  busy = false,
  compact = false,
  queue,
  mobileActions,
}: Props) {
  const descriptionId = `${inputId}-constraints`;

  return (
    <div className="space-y-3">
      <FileUploadTrigger
        dropzone
        inputId={inputId}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        busy={busy}
        dropzoneAriaLabel={title}
        describedById={descriptionId}
        onFilesSelected={onFilesSelected}
        className={
          compact
            ? "[&_[role=button]]:min-h-20 [&_[role=button]]:rounded-shell-card [&_[role=button]]:px-4 [&_[role=button]]:py-4"
            : "[&_[role=button]]:min-h-32 [&_[role=button]]:rounded-shell-card [&_[role=button]]:px-5 [&_[role=button]]:py-6"
        }
      >
        <ImagePlus className="size-5 text-secondary" aria-hidden />
        <span className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          {title}
        </span>
        <span
          id={descriptionId}
          className="max-w-2xl text-center font-body text-sm text-on-surface-variant"
        >
          {description}
        </span>
      </FileUploadTrigger>
      {mobileActions}
      {queue}
    </div>
  );
}
