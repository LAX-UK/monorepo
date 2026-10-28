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
 *
 * Labels on the info, warning and danger tints, and the info and warning glyph circles, use the `*-on-surface`
 * tokens, which every product theme defines to reach 4.5:1 on the tint in light and dark.
 * Bright `live-red` stays on the live glyph circle only.
 */
const BASE =
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-label text-xs font-semibold leading-[18px]";

const ICON_SHELL = "pl-1 pr-3 py-0.5";

export type StatusTagGlyph =
  | "live"
  | "check"
  | "x"
  | "warning"
  | "info"
  | "banned"
  | "file"
  | "clock"
  | "eye";

export type StatusTagVariant = {
  shell: string;
  iconColor: string;
  iconBg: string;
  /** Glyph colour on the circle when `text-on-primary` would be too faint on it. */
  glyphColor?: string;
  glyph: StatusTagGlyph;
  useIcon: boolean;
};

function iconShell(bg: string, text: string): string {
  return cn(BASE, ICON_SHELL, bg, text);
}

const SUCCESS_VARIANT: StatusTagVariant = {
  shell: iconShell("bg-success-container", "text-on-success-container"),
  iconColor: "text-on-success-container",
  iconBg: "bg-success",
  glyph: "check",
  useIcon: true,
};

const INFO_VARIANT: StatusTagVariant = {
  shell: iconShell("bg-info-container", "text-info-on-surface"),
  iconColor: "text-info-on-surface",
  iconBg: "bg-info-on-surface",
  glyph: "info",
  useIcon: true,
};

const PUBLIC_VARIANT: StatusTagVariant = {
  shell: iconShell("bg-info-container", "text-info-on-surface"),
  iconColor: "text-info-on-surface",
  iconBg: "bg-info-on-surface",
  glyph: "eye",
  useIcon: true,
};

/** Figma Tag-Review: one shell + icon color + glyph per tone. */
export const STATUS_TAG_VARIANT: Record<DotStatusPillTone, StatusTagVariant> = {
  live: {
    shell: iconShell("bg-danger-container", "text-danger-on-surface"),
    iconColor: "text-danger-on-surface",
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
    shell: iconShell("bg-warning-container", "text-warning-on-surface"),
    iconColor: "text-warning-on-surface",
    iconBg: "bg-warning-on-surface",
    glyph: "warning",
    useIcon: true,
  },
  pending: {
    shell: iconShell("bg-info-container", "text-info-on-surface"),
    iconColor: "text-info-on-surface",
    iconBg: "bg-info-on-surface",
    glyph: "clock",
    useIcon: true,
  },
  info: INFO_VARIANT,
  draft: {
    shell: iconShell("bg-info-container", "text-info-on-surface"),
    iconColor: "text-info-on-surface",
    iconBg: "bg-info-on-surface",
    glyph: "file",
    useIcon: true,
  },
  critical: {
    shell: iconShell("bg-danger-container", "text-danger-on-surface"),
    iconColor: "text-danger-on-surface",
    iconBg: "bg-danger",
    glyph: "banned",
    useIcon: true,
  },
  accent: {
    shell: iconShell("bg-brand-light-cream", "text-brand-900"),
    iconColor: "text-brand-900",
    iconBg: "bg-accent-gold",
    // Gold is light in both themes, so the glyph stays ink.
    glyphColor: "text-brand-900",
    glyph: "info",
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
