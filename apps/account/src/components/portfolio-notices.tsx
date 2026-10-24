import { Button } from "@/components/account-button";
import type { SourceNoticeVm } from "@/server/domain/portfolio-composition";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { withProductNames } from "./product-name";

/**
 * Says which products could not answer in full, so the figures below are never read as complete.
 * When a product did not answer at all, `retryHref` offers to load the page again.
 */
export function PortfolioNotices({
  notices,
  retryHref,
}: {
  notices: SourceNoticeVm[];
  retryHref?: string;
}) {
  if (notices.length === 0) return null;
  const canRetry = retryHref !== undefined && notices.some((n) => n.id.startsWith("unavailable"));
  return (
    <div className="flex flex-col gap-2">
      {notices.map((notice) => (
        <Alert key={notice.id} variant="warning">
          <AlertDescription>{withProductNames(notice.text)}</AlertDescription>
        </Alert>
      ))}
      {canRetry ? (
        <Button asChild variant="outline" className="self-start">
          <a href={retryHref}>Try again</a>
        </Button>
      ) : null}
    </div>
  );
}
