import type { PayNotice } from "@/lib/pay/pay-page.vm";
import { ButtonLink, Notice } from "@auction/ui/lax";
import Link from "next/link";

/**
 * The checks that stand in the way and what was left out, each as a kit notice with at most one
 * action. They are status messages, read when the page loads; a failure of Pay itself is the
 * alert in `PayFeedbackNotice`.
 */
export function PayNotices({ notices }: { notices: readonly PayNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {notices.map((notice) => (
        <Notice
          key={notice.title}
          tone={notice.tone}
          title={notice.title}
          actions={
            notice.action ? (
              <ButtonLink href={notice.action.href} Link={Link} variant="secondary">
                {notice.action.label}
              </ButtonLink>
            ) : undefined
          }
        >
          {notice.detail}
        </Notice>
      ))}
    </div>
  );
}
