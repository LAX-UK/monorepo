/** What happened to a sign-up posted from the cover's email field. */
export const COVER_ALERTS_OUTCOMES = ["subscribed", "invalid", "failed"] as const;
export type CoverAlertsOutcome = (typeof COVER_ALERTS_OUTCOMES)[number];

/** The query parameter the sign-up route redirects home with. */
export const COVER_ALERTS_PARAM = "alerts";

export function parseCoverAlertsOutcome(value: string | undefined): CoverAlertsOutcome | null {
  return COVER_ALERTS_OUTCOMES.find((outcome) => outcome === value) ?? null;
}

/** The message shown above the page: calm, one line, and what to do about a problem. */
export const COVER_ALERTS_MESSAGE: Record<
  CoverAlertsOutcome,
  { tone: "success" | "danger"; title: string }
> = {
  subscribed: {
    tone: "success",
    title: "You’re on the list. We’ll email you when new sales open.",
  },
  invalid: { tone: "danger", title: "Enter a valid email address and try again." },
  failed: { tone: "danger", title: "We couldn’t sign you up just now. Please try again." },
};
