"use client";

import { UploadIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";

export type FileUploadTriggerProps = {
  onFilesSelected: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
  capture?: "environment" | "user" | boolean;
  disabled?: boolean;
  busy?: boolean;
  dropzone?: boolean;
  helperText?: string;
  inputId?: string;
  /** Accessible name for dropzone mode (required when children are decorative). */
  dropzoneAriaLabel?: string;
  className?: string;
  children?: React.ReactNode;
};

/** Visible upload UI; native file input is hidden inside this primitive only. */
function FileUploadTrigger({
  onFilesSelected,
  accept,
  multiple = false,
  capture,
  disabled = false,
  busy = false,
  dropzone = false,
  helperText,
  inputId,
  dropzoneAriaLabel = "Upload file",
  className,
  children,
}: FileUploadTriggerProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const fileInputId = inputId ?? React.useId();
  const [dragOver, setDragOver] = React.useState(false);

  function pick() {
    if (disabled || busy) return;
    inputRef.current?.click();
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) onFilesSelected(files);
    e.target.value = "";
  }

  function onDrop(ev: React.DragEvent) {
    ev.preventDefault();
    setDragOver(false);
    if (disabled || busy) return;
    const files = ev.dataTransfer.files;
    if (files.length > 0) onFilesSelected(files);
  }

  const content = children ?? (
    <>
      <UploadIcon className="size-4" />
      Choose file
    </>
  );

  return (
    <div className={cn("grid gap-2", className)}>
      <input
        ref={inputRef}
        id={fileInputId}
        type="file"
        accept={accept}
        multiple={multiple}
        {...(capture !== undefined ? { capture } : {})}
        className="sr-only"
        disabled={disabled || busy}
        onChange={onInputChange}
      />
      {dropzone ? (
        <button
          type="button"
          aria-label={dropzoneAriaLabel}
          disabled={disabled || busy}
          onClick={pick}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-outline-variant bg-surface-container-lowest px-4 py-6 text-sm text-on-surface-variant transition-colors",
            dragOver && "border-primary bg-primary/5",
            (disabled || busy) && "cursor-not-allowed opacity-60",
          )}
        >
          {content}
        </button>
      ) : (
        <Button type="button" variant="outline" disabled={disabled || busy} onClick={pick}>
          {content}
        </Button>
      )}
      {helperText ? <p className="text-xs text-on-surface-variant">{helperText}</p> : null}
    </div>
  );
}

export { FileUploadTrigger };
