import type { DotStatusPillTone } from "../components/ui/dot-status-pill.js";

/** Matches legacy `StatusBadge` variant prop — bridged to Tag-Review tones. */
export type StatusBadgeVariant = "neutral" | "info" | "success" | "warning" | "danger" | "live";

/** Maps registry variant → DotStatusPill tone (single bridge, no drift). */
export function statusBadgeVariantToDotTone(variant: StatusBadgeVariant): DotStatusPillTone {
  switch (variant) {
    case "live":
      return "live";
    case "success":
      return "success";
    case "info":
      return "info";
    case "warning":
      return "warning";
    case "danger":
      return "critical";
    case "neutral":
      return "neutral";
  }
}

export type StatusPresentationInput = {
  label: string;
  variant: StatusBadgeVariant;
};

/** Registry/resolver output → DotStatusPill props. */
export function presentationToDotStatus(presentation: StatusPresentationInput): {
  label: string;
  tone: DotStatusPillTone;
} {
  return {
    label: presentation.label,
    tone: statusBadgeVariantToDotTone(presentation.variant),
  };
}
