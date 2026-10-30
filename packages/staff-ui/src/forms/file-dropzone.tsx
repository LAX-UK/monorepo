"use client";

import { useField } from "@auction/ui/lax";
import { FileUp, ImagePlus } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn.js";

export type FileDropzoneProps = {
  /** Called with the chosen or dropped files that match `accept`. */
  onFiles: (files: File[]) => void;
  /** MIME types, e.g. "image/jpeg,image/png,image/webp". */
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  /** The action, e.g. "Upload images". */
  label: string;
  /** What is accepted, e.g. "JPEG, PNG or WebP, up to 20 MB". */
  hint?: string;
  id?: string;
  /** One line, for adding more once some files are in. */
  compact?: boolean;
  /** Pictures (default) or any file, for the icon. */
  kind?: "image" | "file";
  className?: string;
};

function matchesAccept(file: File, accept: string): boolean {
  const allowed = accept.split(",").map((type) => type.trim().toLowerCase());
  return allowed.some((type) =>
    type.endsWith("/*") ? file.type.startsWith(type.slice(0, -1)) : file.type === type,
  );
}

/**
 * A drop area that is also a file picker: click or press Enter/Space to browse, or drop files on
 * it. The native file input sits inside, visually hidden, so it keeps the browser's own picker,
 * keyboard access and screen reader name; the box shows hover, drag-over, focus and disabled.
 */
export function FileDropzone({
  onFiles,
  accept,
  multiple = false,
  disabled,
  label,
  hint,
  id,
  compact = false,
  kind = "image",
  className,
}: FileDropzoneProps) {
  const field = useField();
  const autoId = React.useId();
  const inputId = id ?? field?.controlId ?? `dropzone-${autoId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const isDisabled = disabled ?? field?.disabled ?? false;
  const [dragging, setDragging] = React.useState(false);
  const Icon = kind === "file" ? FileUp : ImagePlus;
  const describedBy = [field?.describedBy, hintId].filter(Boolean).join(" ") || undefined;

  const take = (list: FileList | null) => {
    if (!list || isDisabled) return;
    const files = Array.from(list).filter((file) => matchesAccept(file, accept));
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <label
      htmlFor={inputId}
      data-dragging={dragging || undefined}
      data-disabled={isDisabled || undefined}
      onDragOver={(event) => {
        if (isDisabled) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        take(event.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer rounded-staff-lg border border-dashed",
        compact
          ? "flex-row flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2.5 text-left"
          : "flex-col items-center justify-center gap-1.5 px-4 py-6 text-center",
        "border-staff-line-strong bg-staff-surface transition-[border-color,background-color] duration-150 ease-out",
        "hover:border-staff-line-hover hover:bg-staff-hover",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-staff-focus",
        // Held over: the product accent, a solid edge and a tint, so it reads as ready to take the file.
        "data-[dragging]:border-solid data-[dragging]:border-staff-accent data-[dragging]:bg-staff-accent/[0.07]",
        "data-[disabled]:cursor-not-allowed data-[disabled]:border-staff-line data-[disabled]:bg-staff-sunken data-[disabled]:hover:bg-staff-sunken",
        className,
      )}
    >
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={isDisabled}
        className="sr-only"
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
        onChange={(event) => {
          take(event.target.files);
          // Let the same file be chosen again after it was removed.
          event.target.value = "";
        }}
      />
      <Icon
        aria-hidden
        className={cn(
          "size-5",
          isDisabled ? "text-staff-disabled" : dragging ? "text-staff-accent" : "text-staff-subtle",
        )}
        strokeWidth={1.75}
      />
      <span
        className={cn(
          "text-staff-sm font-medium",
          isDisabled ? "text-staff-disabled" : "text-staff-fg",
        )}
      >
        {dragging ? "Drop to upload" : label}
      </span>
      {isDisabled || dragging ? null : (
        <span className="text-staff-xs text-staff-muted">
          {compact ? "or drag files here" : "Drag files here, or click to browse"}
        </span>
      )}
      {hint ? (
        <span
          id={hintId}
          className={cn("text-staff-xs text-staff-muted", compact && "basis-full pl-7")}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}
