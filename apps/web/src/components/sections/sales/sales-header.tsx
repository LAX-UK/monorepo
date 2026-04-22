import { BodyText, DisplayHeading } from "@auction/ui";

const SUBTITLE =
  "Explore upcoming auctions and browse past results from London, featuring the best of Modern & Contemporary Art, Design and Luxury.";

export function SalesHeader() {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-start md:gap-3">
        <DisplayHeading
          as="h1"
          className="shrink-0 text-[40px] font-semibold leading-[60px] text-brand-900 dark:text-on-surface"
        >
          Calendar
        </DisplayHeading>
        <BodyText className="max-w-[834px] text-2xl font-normal leading-[135%] text-brand-300 dark:text-on-surface-variant">
          {SUBTITLE}
        </BodyText>
      </div>
    </div>
  );
}
