import type { SourceNoticeVm } from "@/server/domain/portfolio-composition";
import { Alert, AlertDescription } from "@auction/ui/components/alert";

/** Says which products could not answer in full, so the figures below are never read as complete. */
export function PortfolioNotices({ notices }: { notices: SourceNoticeVm[] }) {
  if (notices.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {notices.map((notice) => (
        <Alert key={notice.id} variant="warning">
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
