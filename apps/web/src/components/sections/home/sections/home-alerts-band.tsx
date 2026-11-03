import {
  COVER_ALERTS_MESSAGE,
  type CoverAlertsOutcome,
  HOME_ALERTS_ANCHOR,
} from "@/lib/marketing-cover/cover-alerts-outcome";
import { HOME_COVER_NOTIFY_ACTION } from "@/lib/marketing-cover/home-cover-links";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { TOPIC_CATALOGUE } from "@auction/alerts/topics";
import { Notice } from "@auction/ui/lax";
import { HomeAlertsSignedIn } from "./home-alerts-signed-in";
import { HomeAlertsVisitorForm } from "./home-alerts-visitor-form";

/** One announcement per sale: the promise matches what is sent. */
const VISITOR_COPY = {
  heading: "Hear about new sales first",
  body: "One email when a sale is announced, with its dates and catalogue. At most one email a day.",
};

type Props = {
  /** A signed-in client turns alerts on with one press; the form is for visitors. */
  signedIn: boolean;
  /** What happened to a sign-up posted from this page, if one was. */
  outcome: CoverAlertsOutcome | null;
};

/**
 * Email-only sale announcements for visitors, with a confirmation email before anything is sent.
 * The form posts as a plain form, so it works without script. A signed-in client turns alerts on with
 * one press, or sees that they are on.
 */
export function HomeAlertsBand({ signedIn, outcome }: Props) {
  const copy = VISITOR_COPY;
  const message = outcome ? COVER_ALERTS_MESSAGE[outcome] : null;
  const submitted = outcome === "submitted";
  return (
    <section
      id={HOME_ALERTS_ANCHOR}
      aria-labelledby="home-alerts-heading"
      className="scroll-mt-[var(--header-height,4rem)] pt-16 md:pt-24"
    >
      <div className={MARKETING_PAGE_SHELL}>
        <div className="grid gap-5 border-y border-border-hairline py-7 md:grid-cols-2 md:items-center md:gap-12 md:py-10">
          {signedIn ? (
            <HomeAlertsSignedIn />
          ) : (
            <>
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
              {submitted && message ? (
                <Notice
                  tone={message.tone}
                  title={message.title}
                  className="md:max-w-[480px] md:justify-self-end"
                >
                  {message.body}
                </Notice>
              ) : (
                <HomeAlertsVisitorForm
                  action={HOME_COVER_NOTIFY_ACTION}
                  outcome={outcome}
                  message={message}
                  consent={TOPIC_CATALOGUE["bid.new_sales"].consentText}
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
