/** What happened to a sale-alerts sign-up posted from the home page. */
export const COVER_ALERTS_OUTCOMES = ["submitted", "invalid", "limited", "failed"] as const;
export type CoverAlertsOutcome = (typeof COVER_ALERTS_OUTCOMES)[number];

/** The query parameter the sign-up route redirects home with. */
export const COVER_ALERTS_PARAM = "alerts";

/** The anchor of the alerts band, where the visitor is sent back to read the outcome. */
export const HOME_ALERTS_ANCHOR = "alerts";

/** The link to the alerts band from other pages. */
export const HOME_ALERTS_HREF = `/#${HOME_ALERTS_ANCHOR}`;

/** Where the two sign-up forms on the home page say their request came from. */
export const ALERT_SIGNUP_SOURCES = ["web_home_alerts", "web_home_cover"] as const;
export type AlertSignupSource = (typeof ALERT_SIGNUP_SOURCES)[number];

export function parseCoverAlertsOutcome(value: string | undefined): CoverAlertsOutcome | null {
  return COVER_ALERTS_OUTCOMES.find((outcome) => outcome === value) ?? null;
}

export function parseAlertSignupSource(value: unknown): AlertSignupSource {
  return ALERT_SIGNUP_SOURCES.find((source) => source === value) ?? "web_home_cover";
}

/** The message shown in the alerts band: calm, short, and what to do about a problem. */
export const COVER_ALERTS_MESSAGE: Record<
  CoverAlertsOutcome,
  { tone: "success" | "danger"; title: string; body: string }
> = {
  submitted: {
    tone: "success",
    title: "Check your email",
    body: "We've sent a link to confirm your sale alerts. It works for 48 hours. If it doesn't arrive, check your spam folder.",
  },
  invalid: {
    tone: "danger",
    title: "Enter a valid email address",
    body: "Check it for typing mistakes and try again.",
  },
  limited: {
    tone: "danger",
    title: "Too many attempts",
    body: "Wait a minute, then try again.",
  },
  failed: {
    tone: "danger",
    title: "We couldn't sign you up just now",
    body: "Please try again in a moment.",
  },
};
