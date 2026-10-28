import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import { useId } from "react";
import { MarketingSectionHeader } from "../marketing-section-header.js";
import { MarketingProductDoor, type MarketingProductDoorVm } from "./marketing-product-door.js";

export type MarketingProductDoorsProps = {
  /** Section title, e.g. "Across LAX". */
  title: string;
  /** One supporting line under the title. */
  description?: string;
  /** The host's doors, in the order it wants them; a product without a URL is left out upstream. */
  doors: readonly MarketingProductDoorVm[];
  className?: string;
  "data-testid"?: string;
};

const SIZES = {
  pair: "(min-width: 48rem) 50vw, 100vw",
  single: "(min-width: 48rem) 66vw, 100vw",
} as const;

/**
 * How one LAX product presents the others: a titled section of illustrated doors, each the
 * product's lockup (in its accent), art, title, promise and an action that leaves for it. Every
 * product renders its siblings with this component, so the family looks the same from anywhere.
 *
 * Two doors sit side by side from `md`; a lone door is centred at two thirds of the width; none
 * renders nothing. Phones stack the doors with the art cropped to 3:2.
 */
export function MarketingProductDoors({
  title,
  description,
  doors,
  className,
  "data-testid": testId,
}: MarketingProductDoorsProps) {
  const headingId = useId();
  if (doors.length === 0) return null;
  const single = doors.length === 1;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-6 md:gap-8", className)}
      data-testid={testId}
    >
      <MarketingSectionHeader
        heading={
          <h2
            id={headingId}
            className="m-0 font-headline text-[length:var(--text-title-section,clamp(1.5rem,2.8vw,2.5rem))] font-medium leading-[1.2] text-on-surface"
          >
            {title}
          </h2>
        }
        {...(description ? { subtitle: description } : {})}
      />
      <ul
        className={cn(
          "m-0 grid list-none gap-12 p-0 md:gap-10",
          single ? "md:mx-auto md:w-2/3" : "md:grid-cols-2",
        )}
      >
        {doors.map((door) => (
          <li key={door.product} className="flex">
            <MarketingProductDoor door={door} sizes={single ? SIZES.single : SIZES.pair} />
          </li>
        ))}
      </ul>
    </section>
  );
}
