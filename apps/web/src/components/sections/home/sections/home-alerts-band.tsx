import {
  COVER_ALERTS_MESSAGE,
  type CoverAlertsOutcome,
  HOME_ALERTS_ANCHOR,
} from "@/lib/marketing-cover/cover-alerts-outcome";
import { HOME_COVER_NOTIFY_ACTION } from "@/lib/marketing-cover/home-cover-links";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { bidSettingsHref } from "@/lib/navigation/settings-links";
import { type HomeState, VISITOR_ALERT_CONSENT_TEXT } from "@auction/domain";
import { Button, ButtonLink, Notice, TextInput } from "@auction/ui/lax";
import Link from "next/link";

type Copy = { heading: string; body: string };

/** What the sign-up promises, by what the page leads with. */
const COPY: Record<HomeState, Copy> = {
  live: {
    heading: "Hear about new sales first",
    body: "One email when new sales are announced, then the catalogue when it goes online.",
  },
  justEnded: {
    heading: "Hear when new sales are announced",
    body: "One email when dates are set, then the catalogue when it goes online.",
  },
  upcoming: {
    heading: "Never miss an opening",
    body: "We email when a sale opens and when its catalogue goes online.",
  },
  recentResults: {
    heading: "Hear when new sales are announced",
    body: "One email when dates are set, then the catalogue when it goes online.",
  },
  betweenSeasons: {
    heading: "Hear when new sales are announced",
    body: "One email when dates are set, then the catalogue when it goes online.",
  },
};

const SIGNED_IN_COPY: Copy = {
  heading: "Your sale alerts",
  body: "Choose which sales and artists you hear about, and where, in your settings.",
};

type Props = {
  state: HomeState;
  /** Signed-in clients manage alerts in settings; the form is for visitors. */
  signedIn: boolean;
  /** What happened to a sign-up posted from this page, if one was. */
  outcome: CoverAlertsOutcome | null;
};

/**
 * Email-only sale announcements for visitors, with a confirmation email before anything is sent.
 * It posts as a plain form, so it works without script. A signed-in client is sent to their own
 * alert settings instead.
 */
export function HomeAlertsBand({ state, signedIn, outcome }: Props) {
  const copy = signedIn ? SIGNED_IN_COPY : COPY[state];
  const message = outcome ? COVER_ALERTS_MESSAGE[outcome] : null;
  const submitted = outcome === "submitted";
  const problemId = "home-alerts-problem";
  return (
    <section
      id={HOME_ALERTS_ANCHOR}
      aria-labelledby="home-alerts-heading"
      className="scroll-mt-[var(--header-height,4rem)] pt-16 md:pt-24"
    >
      <div className={MARKETING_PAGE_SHELL}>
        <div className="grid gap-5 border-y border-border-hairline py-7 md:grid-cols-2 md:items-center md:gap-12 md:py-10">
          <div className="min-w-0">
            <h2
              id="home-alerts-heading"
              className="m-0 font-headline text-xl font-medium leading-7 text-on-surface md:text-2xl md:leading-8"
            >
              {copy.heading}
            </h2>
            <p className="m-0 mt-1.5 font-body text-sm leading-[22px] text-on-surface-variant">
              {copy.body}
            </p>
          </div>
          {signedIn ? (
            <div className="md:justify-self-end">
              <ButtonLink Link={Link} href={bidSettingsHref("alerts")} variant="primary" size="md">
                Alert settings
              </ButtonLink>
            </div>
          ) : submitted && message ? (
            <Notice
              tone={message.tone}
              title={message.title}
              className="md:max-w-[480px] md:justify-self-end"
            >
              {message.body}
            </Notice>
          ) : (
            <form
              method="post"
              action={HOME_COVER_NOTIFY_ACTION}
              className="w-full md:max-w-[480px] md:justify-self-end"
            >
              <input type="hidden" name="source" value="web_home_alerts" />
              {message ? (
                <Notice
                  tone={message.tone}
                  title={message.title}
                  alert
                  id={problemId}
                  className="mb-3"
                >
                  {message.body}
                </Notice>
              ) : null}
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <TextInput
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  aria-label="Your email address"
                  placeholder="Your email address"
                  size="md"
                  invalid={outcome === "invalid"}
                  aria-describedby={message ? problemId : undefined}
                  boxClassName="max-md:h-lax-control-lg md:flex-1"
                  className="max-md:text-base"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="max-md:h-lax-control-lg"
                >
                  Get alerts
                </Button>
              </div>
              <p className="m-0 mt-2 font-body text-xs leading-4 text-on-surface-variant">
                {VISITOR_ALERT_CONSENT_TEXT} We&apos;ll ask you to confirm by email first.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
