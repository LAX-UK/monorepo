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
    <HomeSection
      id="home-activity"
      title="Recent activity"
      link={seeAllHref ? { href: seeAllHref, label: "See all" } : null}
    >
      <HomePanel>
        <ol aria-labelledby="home-activity" className="py-2">
          {activity.map((item) => (
            <li
              key={item.key}
              className="grid grid-cols-[0.5rem_minmax(0,1fr)] gap-3 px-5 py-2.5 before:mt-[0.4375rem] before:size-1.5 before:rounded-full before:bg-lax-line-strong before:content-['']"
            >
              <div className="min-w-0 text-lax-14 text-lax-fg">
                {item.href ? (
                  <Link
                    href={item.href}
                    className="rounded-lax-badge underline decoration-lax-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lax-focus"
                  >
                    {item.text}
                  </Link>
                ) : (
                  item.text
                )}
                <time
                  dateTime={item.at}
                  title={item.fullDate}
                  className="block text-lax-13 text-lax-muted tabular-nums"
                >
                  {item.when}
                  <span className="sr-only">, {item.fullDate}</span>
                </time>
              </div>
            </li>
          ))}
        </ol>
      </HomePanel>
    </HomeSection>
  );
}
