"use client";

import { CircleAlert, FileUp, LoaderCircle, RotateCw, X } from "lucide-react";
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";

export type UploadQueueItem = {
  id: string;
  /** The file's name as chosen. */
  name: string;
  /** Sending the file, checking it on the server, or failed. Finished files leave the queue. */
  status: "uploading" | "processing" | "error";
  /** 0–100 while uploading, when known. */
  progress?: number;
  /** Why it failed, as a sentence: "The file is over 20 MB." */
  error?: string;
  /**
   * Whether trying again could work: true for a network or server failure, false when the file
   * itself is refused (wrong type, too large), which offers only removal.
   */
  retryable?: boolean;
};

/**
 * The files on their way in: one row each with its progress, and for a failed one the reason, a
 * retry and a way to drop it. The list is a polite live region, so progress and failures are
 * announced without moving focus.
 */
export function UploadQueue({
  items,
  onRetry,
  onDismiss,
  disabled,
  className,
}: {
  items: readonly UploadQueueItem[];
  onRetry?: (id: string) => void;
  onDismiss?: (id: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <ul aria-live="polite" aria-label="Uploads" className={cn("flex flex-col gap-2", className)}>
      {items.map((item) => {
        const failed = item.status === "error";
        const progress = Math.max(0, Math.min(100, item.progress ?? 0));
        return (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-3 rounded-staff-md border px-3 py-2",
              failed
                ? "border-staff-danger/40 bg-staff-danger-bg"
                : "border-staff-line bg-staff-surface",
            )}
          >
            {failed ? (
              <CircleAlert aria-hidden className="size-4 shrink-0 text-staff-danger" />
            ) : item.status === "processing" ? (
              <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin text-staff-muted" />
            ) : (
              <FileUp aria-hidden className="size-4 shrink-0 text-staff-muted" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-staff-sm font-medium text-staff-fg" title={item.name}>
                {item.name}
              </span>
              {failed ? (
                <span className="text-staff-xs text-staff-danger-fg">
                  {item.error ?? "The upload failed."}
                </span>
              ) : item.status === "processing" ? (
                <span className="text-staff-xs text-staff-muted">Checking the file…</span>
              ) : (
                <div className="flex items-center gap-2">
                  {/* biome-ignore lint/a11y/useFocusableInteractive: a progress bar is read-only status, not a control. */}
                  <div
                    role="progressbar"
                    aria-label={`Uploading ${item.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-staff-sunken"
                  >
                    <div
                      className="h-full rounded-full bg-staff-fg transition-[width] duration-200 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-staff-xs tabular-nums text-staff-muted">
                    {progress}%
                  </span>
                </div>
              )}
            </div>
            {failed && onRetry && item.retryable !== false ? (
              <StaffButton
                size="sm"
                variant="secondary"
                icon={<RotateCw aria-hidden />}
                disabled={disabled}
                onClick={() => onRetry(item.id)}
                aria-label={`Retry ${item.name}`}
              >
                Retry
              </StaffButton>
            ) : null}
            {failed && onDismiss ? (
              item.retryable === false ? (
                <StaffButton
                  size="sm"
                  variant="secondary"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onDismiss(item.id)}
                >
                  Remove
                </StaffButton>
              ) : (
                <StaffButton
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${item.name} from the list`}
                  onClick={() => onDismiss(item.id)}
                >
                  <X aria-hidden />
                </StaffButton>
              )
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
