import type { PayAction, PayNotice } from "@/lib/pay/pay-page.vm";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { Notice } from "@auction/ui/lax/notice";
import { cn } from "@auction/ui/lib/utils";
import Link from "next/link";

/**
 * The checks that stand in the way and what was left out, each as a kit notice with at most one
 * action. They are status messages, read when the page loads; a failure of Pay itself, and a
 * payment that did not complete, are the alert in `PayFeedbackNotice`. On a phone the bar at the bottom already offers the page's one
 * action, so a notice that offers the same step does not show it a second time.
 */
export function PayNotices({
  notices,
  barAction,
}: {
  notices: readonly PayNotice[];
  barAction: PayAction | null;
}) {
  if (notices.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {notices.map((notice) => {
        const inBar = barAction?.kind === "link" && barAction.href === notice.action?.href;
        return (
          <Notice
            key={notice.title}
            tone={notice.tone}
            title={notice.title}
            actions={
              notice.action ? (
                <ButtonLink
                  href={notice.action.href}
                  Link={Link}
                  variant="secondary"
                  className={cn(inBar && "max-lg:hidden")}
                >
                  {notice.action.label}
                </ButtonLink>
              ) : undefined
            }
          >
            {notice.detail}
          </Notice>
        );
      })}
    </div>
  );
}
