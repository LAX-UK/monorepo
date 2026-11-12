import { MarketingSection } from "@/components/marketing/marketing-section";
import type { HomeResultsBand } from "@/lib/home-sections/types";
import { cn } from "@auction/ui/lib/utils";
import { HomeLotGrid, type HomeLotWatch } from "./home-lot-grid";

function Fact({
  label,
  value,
  note,
  wide,
}: {
  label: string;
  value: string;
  note: string | null;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 py-3.5 pr-2.5 md:py-6 md:pr-6",
        "[&:not(:first-child)]:md:border-l [&:not(:first-child)]:md:border-border-hairline [&:not(:first-child)]:md:pl-6",
        wide && "col-span-3 border-b border-border-hairline py-4 md:col-span-1 md:border-b-0",
      )}
    >
      <dt className="font-body text-[13px] leading-5 text-on-surface-variant">{label}</dt>
      <dd className="m-0">
        <span
          className={cn(
            "block font-headline font-medium tabular-nums text-on-surface",
            wide ? "text-xl leading-7" : "text-[17px] leading-6 md:text-2xl md:leading-8",
          )}
        >
          {value}
        </span>
        {note ? (
          <span className="block font-body text-xs leading-4 text-on-surface-variant md:text-[13px] md:leading-5">
            {note}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

/** The last sale's figures as a hairline strip, then its top sold lots. */
export function HomeResultsBandSection({
  band,
  watch,
}: {
  band: HomeResultsBand;
  watch: HomeLotWatch;
}) {
  const { facts } = band;
  return (
    <MarketingSection
      id="home-recent-results"
      heading="Recent results"
      subtitle={band.subtitle}
      action={band.seeAll}
    >
      <dl
        aria-label={`${facts.saleTitle}: results`}
        className="m-0 grid grid-cols-3 border-y border-border-hairline md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]"
      >
        <Fact wide label="Last sale" value={facts.saleTitle} note={facts.endedLabel} />
        <Fact label="Sold" value={facts.sold.value} note={facts.sold.note} />
        <Fact label="Total" value={facts.total.value} note={facts.total.note} />
        {facts.topLot ? (
          <Fact label="Top lot" value={facts.topLot.value} note={facts.topLot.note} />
        ) : null}
      </dl>
      {band.lots.length > 0 ? (
        <div className="mt-7 md:mt-10">
          <HomeLotGrid lots={band.lots} label="Top lots of the last sale" watch={watch} />
        </div>
      ) : null}
    </MarketingSection>
  );
}
