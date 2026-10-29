import type { HomeActivityView } from "@/lib/organisation-home/organisation-home-view";
import Link from "next/link";
import { HomePanel, HomeSection } from "./home-section";

type Props = {
  activity: readonly HomeActivityView[];
  seeAllHref: string | null;
};

/**
 * The five newest things this role may see, newest first, each with how long ago it happened
 * (the full date on hover). With nothing to list the section is left out.
 */
export function HomeActivity({ activity, seeAllHref }: Props) {
  if (activity.length === 0) return null;
  return (
    <HomeSection id="home-activity" title="Recent activity" seeAllHref={seeAllHref}>
      <HomePanel>
        <ol aria-labelledby="home-activity" className="divide-y divide-border-hairline">
          {activity.map((item) => (
            <li
              key={item.key}
              className="flex min-h-14 flex-col justify-center gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5"
            >
              {item.href ? (
                <Link
                  href={item.href}
                  className="min-w-0 rounded-sm font-body text-sm text-on-surface underline decoration-outline-variant underline-offset-4 transition-colors duration-150 hover:decoration-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {item.text}
                </Link>
              ) : (
                <span className="min-w-0 font-body text-sm text-on-surface">{item.text}</span>
              )}
              <time
                dateTime={item.at}
                title={item.fullDate}
                className="shrink-0 font-body text-xs text-on-surface-variant tabular-nums"
              >
                {item.when}
                <span className="sr-only">, {item.fullDate}</span>
              </time>
            </li>
          ))}
        </ol>
      </HomePanel>
    </HomeSection>
  );
}
