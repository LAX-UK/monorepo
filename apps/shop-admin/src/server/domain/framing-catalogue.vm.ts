import type { FramingOption } from "@auction/shop-contracts";
import {
  FRAMING_GLAZING_LABELS,
  FRAMING_MOUNT_LABELS,
  framingLeadTimeLabel,
} from "@auction/shop-domain";
import { presentStatus } from "./staff-status";

/*
 * The framing catalogue as staff read it: each option's details line, its lead time, what it is
 * used on, the notice about placeholder prices, and which actions a row offers in its state. Pure,
 * so the rules are tested without rendering.
 */

export const presentFramingStatus = presentStatus("framing");

/** "Window mount, white conservation board · UV-filtering acrylic". */
export function framingDetails(option: Pick<FramingOption, "mount" | "glazing">): string {
  return `${FRAMING_MOUNT_LABELS[option.mount]} · ${FRAMING_GLAZING_LABELS[option.glazing]}`;
}

/** "10 to 15 working days". */
export function framingLeadTime(
  option: Pick<FramingOption, "leadTimeMinDays" | "leadTimeMaxDays">,
): string {
  return framingLeadTimeLabel(option.leadTimeMinDays, option.leadTimeMaxDays);
}

/** "14 editions", "1 edition", or null when no edition offers it. */
export function framingUsedOn(option: Pick<FramingOption, "editionCount">): string | null {
  if (option.editionCount === 0) return null;
  return `${option.editionCount} ${option.editionCount === 1 ? "edition" : "editions"}`;
}

/** How many options still carry the launch placeholder prices. */
export function placeholderOptionCount(
  options: readonly Pick<FramingOption, "pricesPlaceholder">[],
) {
  return options.filter((option) => option.pricesPlaceholder).length;
}

export type FramingRowAction =
  | { kind: "edit" }
  | { kind: "pause" }
  | { kind: "offer"; blockedReason?: string };

export const PLACEHOLDER_BLOCK_REASON = "Replace the placeholder prices first";

/**
 * The actions a row offers. Staff without edit rights get none. An active option can be paused;
 * a draft or paused one can be offered, unless its prices are still the launch placeholders.
 */
export function framingRowActions(
  option: Pick<FramingOption, "status" | "pricesPlaceholder">,
  options: { canEdit: boolean },
): FramingRowAction[] {
  if (!options.canEdit) return [];
  if (option.status === "active") return [{ kind: "edit" }, { kind: "pause" }];
  return [
    { kind: "edit" },
    option.pricesPlaceholder
      ? { kind: "offer", blockedReason: PLACEHOLDER_BLOCK_REASON }
      : { kind: "offer" },
  ];
}

/** What pausing does, in words, with the number of editions that offer the option. */
export function pauseDescription(option: Pick<FramingOption, "editionCount">): string {
  const { editionCount } = option;
  if (editionCount === 0) {
    return "No edition offers it yet. Shoppers will not see it, and you can offer it again at any time.";
  }
  const offering = editionCount === 1 ? "1 edition offers it" : `${editionCount} editions offer it`;
  return `${offering}. Shoppers stop seeing it at once. Baskets that already hold it keep it until checkout, and paid orders are not affected.`;
}
