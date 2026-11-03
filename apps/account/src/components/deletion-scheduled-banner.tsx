import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { NOTICE, NoticeTitle } from "./account-ui";

/**
 * Shown on every page while the person has asked to delete their account, so a request made a
 * month ago is never a surprise. It names the day and leads to the one place that cancels it.
 */
export function DeletionScheduledBanner({
  dueOn,
  cancelHref,
}: {
  /** The day the account is erased, already written for a reader, such as "2 December". */
  dueOn: string;
  cancelHref: string;
}) {
  return (
    <Alert variant="warning" role="note" className={NOTICE}>
      <NoticeTitle>{`Deletion scheduled for ${dueOn}`}</NoticeTitle>
      <AlertDescription>We'll delete your account then, unless you cancel.</AlertDescription>
      <a
        href={cancelHref}
        className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-on-surface underline underline-offset-4"
      >
        Cancel deletion
      </a>
    </Alert>
  );
}
