import type { HomeAlertThumbnail } from "@/lib/home-sections/types";
import {
  COVER_ALERTS_MESSAGE,
  type CoverAlertsOutcome,
} from "@/lib/marketing-cover/cover-alerts-outcome";
import { HOME_COVER_NOTIFY_ACTION } from "@/lib/marketing-cover/home-cover-links";
import { TOPIC_CATALOGUE } from "@auction/alerts/topics";
import { Notice } from "@auction/ui/lax";
import { HomeAlertsPanel } from "./home-alerts-panel";
import { HomeAlertsSignedIn } from "./home-alerts-signed-in";
import { HomeAlertsVisitorForm } from "./home-alerts-visitor-form";

/** One announcement per sale: the promise matches what is sent. */
export const VISITOR_COPY = {
  title: "Hear about new sales first",
  body: "One email when a sale is announced, with its dates and catalogue. At most one email a day.",
};

type Props = {
  /** A signed-in client turns alerts on with one press; the form is for visitors. */
  signedIn: boolean;
  /** What happened to a sign-up posted from this page, if one was. */
  outcome: CoverAlertsOutcome | null;
  thumbnails?: readonly HomeAlertThumbnail[];
};

/**
 * Email-only sale announcements for visitors, with a confirmation email before anything is sent.
 * The form posts as a plain form, so it works without script. A signed-in client turns alerts on
 * with one press, or sees that they are on and is never asked again.
 */
export function HomeAlertsBand({ signedIn, outcome, thumbnails = [] }: Props) {
  if (signedIn) return <HomeAlertsSignedIn thumbnails={thumbnails} />;
  const message = outcome ? COVER_ALERTS_MESSAGE[outcome] : null;
  const submitted = outcome === "submitted";
  return (
    <HomeAlertsPanel
      title={VISITOR_COPY.title}
      body={VISITOR_COPY.body}
      thumbnails={thumbnails}
      action={
        submitted && message ? (
          <Notice tone={message.tone} title={message.title} className="text-start">
            {message.body}
          </Notice>
        ) : (
          <HomeAlertsVisitorForm
            action={HOME_COVER_NOTIFY_ACTION}
            outcome={outcome}
            message={message}
            consent={TOPIC_CATALOGUE["bid.new_sales"].consentText}
          />
        )
      }
    />
  );
}
