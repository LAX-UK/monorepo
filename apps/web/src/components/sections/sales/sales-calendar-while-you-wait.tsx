import type { WhileYouWaitLink } from "@/lib/marketing/sales-calendar-while-you-wait";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

/**
 * Real neighbours under an empty calendar: the last result and open consignments. Nothing is
 * drawn when there are none, so the empty state never points at another empty list.
 */
export function SalesCalendarWhileYouWait({ links }: { links: readonly WhileYouWaitLink[] }) {
  if (links.length === 0) return null;
  return (
    <section aria-labelledby="calendar-while-you-wait" className="pb-6">
      <h2 id="calendar-while-you-wait" className="font-lax text-lax-14 font-medium text-lax-muted">
        While you wait
      </h2>
      <ul className="mt-3 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        {links.map((link) => (
          <li key={link.id}>
            <Link
              href={link.href}
              className="lax-focus group flex h-full items-center justify-between gap-4 rounded-lax-menu border border-lax-line bg-lax-surface p-4 hover:border-lax-control-edge-hover"
            >
              <span className="min-w-0">
                <span className="block truncate font-lax text-lax-14 font-medium text-lax-fg">
                  {link.title}
                </span>
                <span className="mt-1 block text-lax-13 leading-5 text-lax-muted">
                  {link.detail}
                </span>
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-lax-subtle" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
