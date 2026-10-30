import type { HomeNoticeView } from "@/lib/organisation-home/organisation-home-view";
import { cn } from "@auction/ui";
import { Info } from "lucide-react";
import Link from "next/link";

type Props = {
  notices: readonly HomeNoticeView[];
  className?: string;
};

const LINK_CLASS =
  "rounded-lax-badge underline decoration-lax-line-strong underline-offset-4 transition-colors duration-150 hover:text-lax-fg hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lax-focus";

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
        <li key={notice.key} className="flex items-start gap-2 text-lax-14 text-lax-muted">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          {notice.href ? (
            <Link href={notice.href} className={LINK_CLASS}>
              {notice.text}
            </Link>
          ) : (
            <span>
              {notice.text}
              {notice.action ? (
                <>
                  {" "}
                  <a
                    href={notice.action.href}
                    className={cn(LINK_CLASS, "font-medium text-lax-fg")}
                  >
                    {notice.action.label}
                  </a>
                  .
                </>
              ) : null}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
