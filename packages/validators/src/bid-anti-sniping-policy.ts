/** Default anti-sniping window: extend when bid arrives within this many ms of lot close. */
export const DEFAULT_ANTI_SNIPING_WINDOW_MS = 2 * 60 * 1000;

/** Default anti-sniping extension: seconds added to lot endTime per qualifying bid. */
export const DEFAULT_ANTI_SNIPING_EXTENSION_MS = 30_000;

function formatDurationLabel(ms: number): string {
  if (ms % 60_000 === 0 && ms >= 60_000) {
    const minutes = ms / 60_000;
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  if (ms % 1_000 === 0 && ms >= 1_000) {
    const seconds = ms / 1_000;
    return seconds === 1 ? "1 second" : `${seconds} seconds`;
  }
  return `${ms}ms`;
}

/** Human-readable anti-sniping window (default: "2 minutes"). */
export function formatAntiSnipingWindowLabel(
  windowMs: number = DEFAULT_ANTI_SNIPING_WINDOW_MS,
): string {
  return formatDurationLabel(windowMs);
}

/** Human-readable anti-sniping extension (default: "30 seconds"). */
export function formatAntiSnipingExtensionLabel(
  extensionMs: number = DEFAULT_ANTI_SNIPING_EXTENSION_MS,
): string {
  return formatDurationLabel(extensionMs);
}

/** Short inline rule for format explainers and sale copy (mechanism only). */
export function formatAntiSnipingRuleSentence(
  windowMs: number = DEFAULT_ANTI_SNIPING_WINDOW_MS,
  extensionMs: number = DEFAULT_ANTI_SNIPING_EXTENSION_MS,
): string {
  const windowLabel = formatAntiSnipingWindowLabel(windowMs);
  const extensionLabel = formatAntiSnipingExtensionLabel(extensionMs);
  return `If a bid is placed in the final ${windowLabel} of a lot's scheduled closing time, that lot's closing time is extended by ${extensionLabel}.`;
}

/** FAQ / help-centre paragraph: per-lot scope and fairness rationale. */
export function formatAntiSnipingClosingRuleParagraph(
  windowMs: number = DEFAULT_ANTI_SNIPING_WINDOW_MS,
  extensionMs: number = DEFAULT_ANTI_SNIPING_EXTENSION_MS,
): string {
  const rule = formatAntiSnipingRuleSentence(windowMs, extensionMs);
  return `${rule} The extension applies to that lot only — not to other lots in the sale — and may repeat until bidding stops, so every registered bidder has a fair chance to respond.`;
}
