import type { LegalEntityStatus } from "@auction/types";
import { cn } from "@auction/ui";
import { statusLabel } from "./labels";

export type EntityStatusTone = "success" | "warning" | "danger" | "neutral";

export function entityStatusTone(status: LegalEntityStatus): EntityStatusTone {
  if (status === "approved") return "success";
  if (status === "restricted" || status === "rejected") return "danger";
  if (
    status === "lead" ||
    status === "docs_requested" ||
    status === "docs_received" ||
    status === "under_review" ||
    status === "connect_pending"
  ) {
    return "warning";
  }
  return "neutral";
}

export function entityStatusLabel(status: LegalEntityStatus): string {
  return statusLabel(status);
}

type StatusDotProps = { status: LegalEntityStatus; className?: string };

export function StatusDot({ status, className }: StatusDotProps) {
  const tone = entityStatusTone(status);
  return (
    <span
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        tone === "success" && "bg-green-600",
        tone === "warning" && "bg-amber-500",
        tone === "danger" && "bg-red-600",
        tone === "neutral" && "bg-on-surface-variant",
        className,
      )}
      aria-hidden
    />
  );
}
