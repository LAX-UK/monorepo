import { HOME_COVER_NOTIFY_ACTION } from "@/lib/marketing-cover/home-cover-links";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import type { HomeState } from "@auction/domain";
import { Button, TextInput } from "@auction/ui/lax";

type Copy = { heading: string; body: string };

/** What the sign-up promises, by what the page leads with. */
const COPY: Record<HomeState, Copy> = {
  live: {
    heading: "Hear about new sales first",
    body: "One email when new sales are announced, then the catalogue when it goes online.",
  },
  justEnded: {
    heading: "Hear when new sales are announced",
    body: "One email when dates are set, then the catalogue when it goes online.",
  },
  upcoming: {
    heading: "Never miss an opening",
    body: "We email when a sale opens and when its catalogue goes online.",
  },
  recentResults: {
    heading: "Hear when new sales are announced",
    body: "One email when dates are set, then the catalogue when it goes online.",
  },
  betweenSeasons: {
    heading: "Hear when new sales are announced",
    body: "One email when dates are set, then the catalogue when it goes online.",
  },
};

/** Email-only sale announcements. It posts as a plain form, so it works without script. */
export function HomeAlertsBand({ state }: { state: HomeState }) {
  const copy = COPY[state];
  return (
    <section
      id="alerts"
      aria-labelledby="home-alerts-heading"
      className="scroll-mt-[var(--header-height,4rem)] pt-16 md:pt-24"
    >
      <div className={MARKETING_PAGE_SHELL}>
        <div className="grid gap-5 border-y border-border-hairline py-7 md:grid-cols-2 md:items-center md:gap-12 md:py-10">
          <div className="min-w-0">
            <h2
              id="home-alerts-heading"
              className="m-0 font-headline text-xl font-medium leading-7 text-on-surface md:text-2xl md:leading-8"
            >
              {copy.heading}
            </h2>
            <p className="m-0 mt-1.5 font-body text-sm leading-[22px] text-on-surface-variant">
              {copy.body}
            </p>
          </div>
          <form
            method="post"
            action={HOME_COVER_NOTIFY_ACTION}
            className="w-full md:max-w-[480px] md:justify-self-end"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <TextInput
                type="email"
                name="email"
                required
                autoComplete="email"
                inputMode="email"
                aria-label="Your email address"
                placeholder="Your email address"
                size="md"
                boxClassName="max-md:h-lax-control-lg md:flex-1"
                className="max-md:text-base"
              />
              <Button type="submit" variant="primary" size="md" className="max-md:h-lax-control-lg">
                Get alerts
              </Button>
            </div>
            <p className="m-0 mt-2 font-body text-xs leading-4 text-on-surface-variant">
              One email when new sales are announced. Unsubscribe any time.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
