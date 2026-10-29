import type { HomeNoticeView } from "@/lib/organisation-home/organisation-home-view";
import { Info } from "lucide-react";
import Link from "next/link";

/**
 * Things to know that are not this member's to do ("Waiting for an owner or admin to choose…").
 * Quiet lines rather than tasks: no button, at most a link to where it can be followed.
 */
export function HomeNotices({ notices }: { notices: readonly HomeNoticeView[] }) {
  if (notices.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="For your information" data-testid="home-notices">
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
