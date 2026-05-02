import { BodyText, DisplayHeading } from "@auction/ui";

const SUBTITLE =
  "Explore upcoming auctions and browse past results from London, featuring the best of Modern & Contemporary Art, Design and Luxury.";

export function SalesHeader() {
  return (
    <div className="-mx-4 bg-brand-900 px-6 py-14 text-white sm:-mx-6 md:-mx-8 md:px-12 md:py-16">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
        <DisplayHeading
          as="h1"
          className="text-5xl font-medium uppercase tracking-tight text-white md:text-6xl"
        >
          Auction Calendar
        </DisplayHeading>
        <BodyText className="max-w-xl text-sm leading-7 text-white/60">{SUBTITLE}</BodyText>
      </div>
    </div>
  );
}
