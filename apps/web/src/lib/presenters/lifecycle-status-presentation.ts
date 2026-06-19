import type { LifecycleBadgeVM } from "@/lib/lot/lot-lifecycle";
import type { StatusPresentation } from "@/lib/presenters/status-presentation";

/** Maps lot lifecycle badge VM → StatusBadge presentation (labels stay in lot-lifecycle). */
export function lifecycleToStatusPresentation(badge: LifecycleBadgeVM): StatusPresentation {
  switch (badge.tone) {
    case "live":
      return { label: badge.label, variant: "live", dot: badge.pulse };
    case "upcoming":
      return { label: badge.label, variant: "info" };
    case "warn":
      return { label: badge.label, variant: "warning", dot: badge.pulse };
    case "ended":
      return {
        label: badge.label,
        variant: badge.label === "Sold" ? "success" : "neutral",
      };
    case "muted":
      return {
        label: badge.label,
        variant: badge.label === "Cancelled" ? "danger" : "neutral",
      };
  }
}
