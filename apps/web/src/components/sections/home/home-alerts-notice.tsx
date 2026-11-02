import {
  COVER_ALERTS_MESSAGE,
  type CoverAlertsOutcome,
} from "@/lib/marketing-cover/cover-alerts-outcome";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { Notice } from "@auction/ui/lax";

/** The result of a sign-up from the cover's email field, shown above the page it came from. */
export function HomeAlertsNotice({ outcome }: { outcome: CoverAlertsOutcome }) {
  const message = COVER_ALERTS_MESSAGE[outcome];
  return (
    <div className={cn(MARKETING_PAGE_SHELL, "pt-4")}>
      <Notice tone={message.tone} title={message.title} alert={message.tone === "danger"} />
    </div>
  );
}
