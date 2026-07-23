import { cn } from "../../lib/utils.js";

/**
 * Delivery-mode Tag-Review taxonomy (format labels, not lifecycle status):
 * - online: blue info container + laptop — timed web auction
 * - onsite: amber warning container + map pin — in-room saleroom
 * - hybrid: secondary/violet container + monitor-smartphone — in-room + online
 *
 * Do not reuse lifecycle status tones (live minus, success checkmark).
 */
export type DeliveryModeTagKey = "online" | "onsite" | "hybrid";

export type DeliveryModeTagGlyph = "laptop" | "mapPin" | "monitorSmartphone";

export type DeliveryModeTagVariant = {
  shell: string;
  iconColor: string;
  iconBg: string;
  glyph: DeliveryModeTagGlyph;
};

const BASE =
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-label text-xs font-semibold leading-[18px]";

const ICON_SHELL = "pl-1 pr-3 py-0.5";

function iconShell(bg: string, text: string): string {
  return cn(BASE, ICON_SHELL, bg, text);
}

export const DELIVERY_MODE_TAG_VARIANT: Record<DeliveryModeTagKey, DeliveryModeTagVariant> = {
  online: {
    shell: iconShell("bg-info-container", "text-info"),
    iconColor: "text-info",
    iconBg: "bg-info",
    glyph: "laptop",
  },
  onsite: {
    shell: iconShell("bg-warning-container", "text-warning"),
    iconColor: "text-warning",
    iconBg: "bg-warning",
    glyph: "mapPin",
  },
  hybrid: {
    shell: iconShell("bg-secondary-container", "text-on-secondary-container"),
    iconColor: "text-on-secondary-container",
    iconBg: "bg-secondary",
    glyph: "monitorSmartphone",
  },
};

export const DELIVERY_MODE_SHELL: Record<DeliveryModeTagKey, string> = Object.fromEntries(
  Object.entries(DELIVERY_MODE_TAG_VARIANT).map(([mode, variant]) => [mode, variant.shell]),
) as Record<DeliveryModeTagKey, string>;
