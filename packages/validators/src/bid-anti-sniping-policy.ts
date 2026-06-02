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

/** Full marketing sentence for English/buy-it-now anti-sniping behaviour. */
export function formatAntiSnipingRuleSentence(
  windowMs: number = DEFAULT_ANTI_SNIPING_WINDOW_MS,
  extensionMs: number = DEFAULT_ANTI_SNIPING_EXTENSION_MS,
): string {
  const windowLabel = formatAntiSnipingWindowLabel(windowMs);
  const extensionLabel = formatAntiSnipingExtensionLabel(extensionMs);
  return `A bid in the final ${windowLabel} extends that lot's closing time by ${extensionLabel} to reduce last-second sniping.`;
}
