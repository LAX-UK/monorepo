/** AV projector session status — high-contrast colors, not marketing StatusBadge registry. */

export type DisplaySessionStatus = "live" | "paused" | "ended" | "standby";

export type DisplayBoardSessionStatus = DisplaySessionStatus | "none" | "pending";

export type DisplaySessionStatusPresentation = {
  label: string;
  className: string;
};

const DISPLAY_STATUS_MAP: Record<DisplaySessionStatus, DisplaySessionStatusPresentation> = {
  live: {
    label: "LIVE",
    className: "bg-emerald-500/20 text-emerald-100 border-emerald-400/40",
  },
  paused: {
    label: "PAUSED",
    className: "bg-amber-500/20 text-amber-100 border-amber-400/40",
  },
  ended: {
    label: "ENDED",
    className: "bg-white/10 text-white/70 border-white/20",
  },
  standby: {
    label: "STANDBY",
    className: "bg-white/10 text-white/70 border-white/20",
  },
};

function normalizeDisplaySessionStatus(status: DisplayBoardSessionStatus): DisplaySessionStatus {
  if (status === "none" || status === "pending") return "standby";
  return status;
}

export function displaySessionStatusPresentation(
  status: DisplayBoardSessionStatus,
): DisplaySessionStatusPresentation {
  return DISPLAY_STATUS_MAP[normalizeDisplaySessionStatus(status)];
}

/** Leading bid row on the AV board — emerald for legibility at distance. */
export const displayLeadingBidRowClassName =
  "motion-safe:animate-artwork-slide-up-fade flex items-center justify-between gap-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 motion-reduce:animate-none motion-reduce:opacity-100";

export const displayBidRowClassName =
  "motion-safe:animate-artwork-slide-up-fade flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-neutral-950/40 px-5 py-4 motion-reduce:animate-none motion-reduce:opacity-100";
