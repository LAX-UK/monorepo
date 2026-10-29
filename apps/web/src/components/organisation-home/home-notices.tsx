import type { HomeNoticeView } from "@/lib/organisation-home/organisation-home-view";
import { cn } from "@auction/ui";
import { Info } from "lucide-react";
import Link from "next/link";

type Props = {
  notices: readonly HomeNoticeView[];
  className?: string;
};

/**
 * Things to know that are not this member's to do ("Waiting for an owner or admin to choose…").
 * Quiet lines rather than tasks: no button, at most a link to where it can be followed. Shown
 * under "Needs you", or on their own for a role that has nothing to do.
 */
export function HomeNotices({ notices, className }: Props) {
  if (notices.length === 0) return null;
  return (
    <ul
      className={cn("space-y-2", className)}
      aria-label="For your information"
      data-testid="home-notices"
    >
      {notices.map((notice) => (
        <li
          key={notice.key}
          className="flex items-start gap-2 font-body text-sm text-on-surface-variant"
        >
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          {notice.href ? (
            <Link
              href={notice.href}
              className="rounded-sm underline-offset-2 transition-colors duration-150 hover:text-on-surface hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-surface"
            >
              {notice.text}
            </Link>
          ) : (
            <span>{notice.text}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
