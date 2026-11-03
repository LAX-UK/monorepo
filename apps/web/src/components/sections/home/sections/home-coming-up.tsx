import { MarketingSection } from "@/components/marketing/marketing-section";
import type { HomeComingUp } from "@/lib/home-sections/types";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { TextLink } from "@auction/ui/lax";
import Link from "next/link";

/** The sales still to come as an exhibition list: a typographic date, the sale, one action. */
export function HomeComingUpSection({ comingUp }: { comingUp: HomeComingUp }) {
  return (
    <MarketingSection id="home-coming-up" heading="Coming up" action={comingUp.seeAll}>
      <ol className="m-0 list-none border-t border-border-hairline p-0">
        {comingUp.rows.map((row) => (
          <li
            key={row.id}
            className="grid gap-1 border-b border-border-hairline py-4 md:grid-cols-[160px_minmax(0,1fr)_auto] md:items-center md:gap-6 md:py-6"
          >
            <p className="m-0 flex items-baseline gap-2 md:block">
              <span className="block font-headline text-lg font-medium leading-6 tabular-nums text-on-surface md:text-2xl md:leading-8">
                {row.dateMain}
              </span>
              <span className="block font-body text-[13px] leading-5 text-on-surface-variant">
                {row.dateSub}
              </span>
            </p>
            <div className="min-w-0">
              <h3 className="m-0 font-headline text-base font-medium leading-6 text-on-surface md:text-xl md:leading-7">
                <Link
                  href={row.href}
                  className={cn("rounded-sm underline-offset-4 hover:underline", FOCUS_RING)}
                >
                  {row.title}
                </Link>
              </h3>
              <p className="m-0 mt-1 font-body text-sm leading-5 text-on-surface-variant">
                {row.meta}
              </p>
            </div>
            <TextLink Link={Link} href={row.action.href} chevron className="mt-2 md:mt-0">
              {row.action.label}
              <span className="sr-only"> {row.title}</span>
            </TextLink>
          </li>
        ))}
      </ol>
    </MarketingSection>
  );
}
