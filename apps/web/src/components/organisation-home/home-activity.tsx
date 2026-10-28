import type { HomeActivityView } from "@/lib/organisation-home/organisation-home-view";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Surface } from "@auction/ui/components/surface";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { HomeSectionHeading } from "./home-section-heading";

type Props = {
  activity: readonly HomeActivityView[];
  seeAllHref: string | null;
};

/** The five newest things this role may see, with a way to the full list. */
export function HomeActivity({ activity, seeAllHref }: Props) {
  return (
    <Surface variant="section" padding="none" className="p-0 sm:p-0">
      <div className="flex items-center justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-5">
        <HomeSectionHeading id="home-activity">Recent activity</HomeSectionHeading>
        {seeAllHref && activity.length > 0 ? (
          <Link
            href={seeAllHref}
            className="inline-flex min-h-11 items-center gap-0.5 rounded-sm font-body text-sm font-medium text-on-surface underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            See all
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
          </Link>
        ) : null}
      </div>
      {activity.length === 0 ? (
        <EmptyState
          variant="plain"
          size="compact"
          headingLevel="h3"
          illustration="ledger"
          title="Nothing here yet"
          description="New submissions, sales and members show here as they happen."
        />
      ) : (
        <ol
          aria-labelledby="home-activity"
          className="divide-y divide-border-hairline px-4 pb-1 sm:px-6"
        >
          {activity.map((item) => (
            <li
              key={item.key}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-3"
            >
              {item.href ? (
                <Link
                  href={item.href}
                  className="min-w-0 rounded-sm font-body text-sm text-on-surface underline decoration-outline-variant underline-offset-4 hover:decoration-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {item.text}
                </Link>
              ) : (
                <span className="min-w-0 font-body text-sm text-on-surface">{item.text}</span>
              )}
              <time
                dateTime={item.at}
                className="shrink-0 font-body text-xs text-on-surface-variant"
              >
                {item.when}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Surface>
  );
}
