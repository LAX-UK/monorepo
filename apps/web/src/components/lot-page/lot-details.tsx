import type { LotDetailsView } from "@/lib/lot-page/lot-details";
import { FactList } from "@auction/ui/lax";
import Link from "next/link";

const TEXT_LINK =
  "lax-focus rounded-sm text-lax-13 leading-5 font-medium text-lax-fg underline decoration-lax-line-strong underline-offset-4 hover:decoration-current";

type Props = {
  details: LotDetailsView;
  /** "25%": printed in the buying note; `null` hides the note (a lot no longer for sale). */
  premiumPercent: string | null;
};

/**
 * Below the fold: the cataloguer's note and the catalogue facts as one description list, and a
 * short note on buying. Sections with nothing to say are left out rather than shown empty.
 */
export function LotDetails({ details, premiumPercent }: Props) {
  const hasWork = details.about.length > 0 || details.facts.length > 0;
  if (!hasWork && premiumPercent === null) return null;
  return (
    <div className="mt-12 grid gap-10 border-t border-lax-line pt-10 lg:mt-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
      {hasWork ? (
        <section aria-labelledby="lot-about-heading" className="min-w-0">
          <h2
            id="lot-about-heading"
            className="m-0 mb-3 font-lax-display text-lax-20 leading-7 font-semibold text-lax-fg"
          >
            About this work
          </h2>
          {details.about.map((paragraph) => (
            <p key={paragraph} className="m-0 mb-4 max-w-[64ch] text-lax-16 leading-6">
              {paragraph}
            </p>
          ))}
          <FactList
            className="mt-6"
            facts={details.facts.map((fact) => ({
              label: fact.label,
              value: fact.links ? (
                <>
                  {fact.text}
                  <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {fact.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        className={TEXT_LINK}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {link.label}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ))}
                  </span>
                </>
              ) : (
                fact.text
              ),
            }))}
          />
        </section>
      ) : null}
      {premiumPercent !== null ? (
        <aside
          aria-labelledby="lot-buying-heading"
          className="self-start rounded-lax-card border border-lax-line p-5"
        >
          <h2
            id="lot-buying-heading"
            className="m-0 mb-2 font-lax-display text-lax-16 leading-6 font-semibold"
          >
            Buying this work
          </h2>
          <p className="m-0 mb-3 text-lax-13 leading-5 text-lax-muted">
            {premiumPercent} buyer&apos;s premium is added to the hammer price. Delivery is quoted
            when you pay.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/terms" className={TEXT_LINK}>
              Conditions of business
            </Link>
            <Link href="/faq" className={TEXT_LINK}>
              How bidding works
            </Link>
            <Link href="/shipping" className={TEXT_LINK}>
              Delivery
            </Link>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
