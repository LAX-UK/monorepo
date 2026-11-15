/**
 * The words of a closing time row, in a module of its own so the countdown leaf can use them
 * without loading the row builders.
 *
 * What the time row says once zero has passed and the server has not said how the lot ended. For
 * the first minute it is "Closing…"; after that the spinner is dropped for an "Ended" row that says
 * the result is being confirmed. Neither says sold or unsold: that needs the server's answer. Once
 * the page has stopped asking (`stalled`), the row also offers a refresh.
 */
export function closingFace(
  confirming: boolean,
  stalled = false,
): {
  label: string;
  value: string;
  sub: string;
  tone: "calm" | "soon" | "final" | "ended";
  refresh?: true;
} {
  return confirming
    ? {
        label: "Ended",
        value: "Confirming the result",
        sub: "The result will appear here once it is confirmed",
        tone: "ended",
        ...(stalled ? { refresh: true as const } : {}),
      }
    : {
        label: "Time left",
        value: "Closing…",
        sub: "The result follows in a moment",
        tone: "final",
      };
}

/** The phone bar's line for the same two moments. */
export function closingBarFace(confirming: boolean): {
  words: string;
  compact: string;
  tone: "calm" | "final";
} {
  return confirming
    ? { words: "Ended · confirming the result", compact: "Confirming result", tone: "calm" }
    : { words: "Closing…", compact: "Closing…", tone: "final" };
}
