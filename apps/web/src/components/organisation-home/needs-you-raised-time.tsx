import type { NeedsYouRaised } from "@/lib/organisation-home/needs-you-view";
import { cn } from "@auction/ui/lib/utils";

/** When a task arose ("3 hours ago", "29 Oct 2026"); nothing when no record says. */
export function NeedsYouRaisedTime({
  raised,
  className,
}: {
  raised: NeedsYouRaised | null;
  className?: string;
}) {
  if (!raised) return null;
  return (
    <time
      dateTime={raised.dateTime}
      className={cn("text-lax-13 tabular-nums text-lax-muted", className)}
    >
      {raised.text}
    </time>
  );
}
