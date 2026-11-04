import type { NavBadgeTone } from "@/lib/shell/contracts";
import type { StaffNavCountTone } from "@auction/staff-ui";

/**
 * The staff shell's count tone for a nav badge: overdue or failed stays danger, work waiting on
 * someone stays warning, a live sale is the ink "attention" fill, anything else is neutral.
 */
export function staffNavCountTone(tone: NavBadgeTone | undefined): StaffNavCountTone {
  switch (tone) {
    case "danger":
      return "danger";
    case "warning":
      return "warning";
    case "live":
      return "attention";
    default:
      return "neutral";
  }
}
