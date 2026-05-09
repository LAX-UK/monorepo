import { BodyText, DisplayHeading } from "@auction/ui";

const SUBTITLE =
  "Explore upcoming auctions and browse past results from London, featuring the best of Modern & Contemporary Art, Design, and luxury.";

/** Hero title + blurb — `calendar.html` (max 1376px row, gap 12px). */
export function SalesHeroHeader() {
  return (
    <header className="w-full max-w-[1376px]">
      <div className="flex flex-col items-start gap-3 lg:flex-row lg:gap-3">
        <div className="relative min-h-[48px] min-w-0 flex-1 lg:min-h-[60px] lg:shrink-0">
          <DisplayHeading
            as="h1"
            className="text-2xl font-semibold leading-tight tracking-tight text-[#050505] motion-safe:transition-opacity motion-safe:duration-500 dark:text-on-surface sm:text-3xl sm:leading-snug lg:text-[40px] lg:leading-[60px]"
          >
            Calendar
          </DisplayHeading>
        </div>
        <BodyText className="w-full max-w-none text-base font-normal leading-relaxed text-[#474747] motion-safe:transition-opacity motion-safe:duration-500 dark:text-on-surface/70 sm:text-lg sm:leading-relaxed lg:max-w-[900px] lg:text-2xl lg:leading-[32.4px]">
          {SUBTITLE}
        </BodyText>
      </div>
    </header>
  );
}
