import { cn } from "../../lib/utils.js";
import type { DotStatusPillTone } from "./dot-status-pill.js";

/**
 * Tag-Review tone taxonomy (shell + icon must match):
 * - live: live-red radio — auction/sale/session actively running
 * - success/sold: green check — positive terminal outcome
 * - info/pending/draft/public: blue info — scheduled, visibility, category
 * - warning: orange triangle — needs staff attention
 * - critical: danger ban — rejected, cancelled, failed
 * - neutral: grey x — ended, inactive, archived
 */
const BASE =
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-label text-xs font-semibold leading-[18px]";

const ICON_SHELL = "pl-1 pr-3 py-0.5";

export type StatusTagGlyph = "live" | "check" | "x" | "warning" | "info" | "banned";

export type StatusTagVariant = {
  shell: string;
  iconColor: string;
  iconBg: string;
  glyph: StatusTagGlyph;
  useIcon: boolean;
};

function iconShell(bg: string, text: string): string {
  return cn(BASE, ICON_SHELL, bg, text);
}

const SUCCESS_VARIANT: StatusTagVariant = {
  shell: iconShell("bg-success-container", "text-success"),
  iconColor: "text-success",
  iconBg: "bg-success",
  glyph: "check",
  useIcon: true,
};

const INFO_VARIANT: StatusTagVariant = {
  shell: iconShell("bg-info-container", "text-info"),
  iconColor: "text-info",
  iconBg: "bg-info",
  glyph: "info",
  useIcon: true,
};

const PUBLIC_VARIANT: StatusTagVariant = {
  ...INFO_VARIANT,
};

/** Figma Tag-Review: one shell + icon color + glyph per tone. */
export const STATUS_TAG_VARIANT: Record<DotStatusPillTone, StatusTagVariant> = {
  live: {
    shell: iconShell("bg-danger-container", "text-live-red"),
    iconColor: "text-live-red",
    iconBg: "bg-live-red",
    glyph: "live",
    useIcon: true,
  },
  sold: SUCCESS_VARIANT,
  success: SUCCESS_VARIANT,
  public: PUBLIC_VARIANT,
  neutral: {
    shell: iconShell("bg-surface-container-high", "text-on-surface-variant"),
    iconColor: "text-on-surface-variant",
    iconBg: "bg-on-surface-variant",
    glyph: "x",
    useIcon: true,
  },
  warning: {
    shell: iconShell("bg-warning-container", "text-warning"),
    iconColor: "text-warning",
    iconBg: "bg-warning",
    glyph: "warning",
    useIcon: true,
  },
  pending: INFO_VARIANT,
  info: INFO_VARIANT,
  draft: INFO_VARIANT,
  critical: {
    shell: iconShell("bg-danger-container", "text-danger"),
    iconColor: "text-danger",
    iconBg: "bg-danger",
    glyph: "banned",
    useIcon: true,
  },
};

/** Figma Tag-Review pill shells (bg + label color). */
export const TONE_SHELL: Record<DotStatusPillTone, string> = Object.fromEntries(
  Object.entries(STATUS_TAG_VARIANT).map(([tone, variant]) => [tone, variant.shell]),
) as Record<DotStatusPillTone, string>;

/** All tones use Lucide glyphs on colored circles. */
export const STATUS_TAG_ICON_TONES: ReadonlySet<DotStatusPillTone> = new Set(
  (Object.entries(STATUS_TAG_VARIANT) as [DotStatusPillTone, StatusTagVariant][])
    .filter(([, variant]) => variant.useIcon)
    .map(([tone]) => tone),
);
