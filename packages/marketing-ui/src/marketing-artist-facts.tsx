import { cn } from "@auction/ui";

export type MarketingArtistFactInput = {
  nationality?: string | null | undefined;
  /** Year as a number or a registry string (`"1471"`); anything else is ignored. */
  birthYear?: number | string | null | undefined;
  deathYear?: number | string | null | undefined;
  /** Discipline or medium, e.g. "Printmaker". */
  discipline?: string | null | undefined;
};

export type MarketingArtistFact = {
  /** Spoken label for screen readers, e.g. "Nationality". */
  label: string;
  value: string;
};

function year(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  const match = value?.trim().match(/^-?\d{1,4}/);
  return match ? Number.parseInt(match[0], 10) : null;
}

/**
 * "1471–1528", "b. 1956" or null. A death year alone is not shown: without a birth year it
 * reads as a mistake.
 */
export function formatMarketingArtistLifespan(
  birthYear: MarketingArtistFactInput["birthYear"],
  deathYear: MarketingArtistFactInput["deathYear"],
): string | null {
  const born = year(birthYear);
  if (born == null) return null;
  const died = year(deathYear);
  return died != null ? `${born}–${died}` : `b. ${born}`;
}

/** Facts in reading order: nationality, life span, discipline. Empty values are left out. */
export function marketingArtistFacts(input: MarketingArtistFactInput): MarketingArtistFact[] {
  const facts: MarketingArtistFact[] = [];
  const nationality = input.nationality?.trim();
  if (nationality) facts.push({ label: "Nationality", value: nationality });
  const lifespan = formatMarketingArtistLifespan(input.birthYear, input.deathYear);
  if (lifespan) facts.push({ label: "Life", value: lifespan });
  const discipline = input.discipline?.trim();
  if (discipline) facts.push({ label: "Discipline", value: discipline });
  return facts;
}

/** Plain "British · b. 1956 · Printmaker" text, for cards and metadata. */
export function marketingArtistFactsLine(input: MarketingArtistFactInput): string | null {
  const facts = marketingArtistFacts(input);
  return facts.length > 0 ? facts.map((f) => f.value).join(" · ") : null;
}

export type MarketingArtistFactsProps = {
  facts: readonly MarketingArtistFact[];
  /**
   * `hero` under the name in the split hero; `band` centred in the full-bleed band, taking the
   * band's text colour; `card` in directory cards.
   */
  size?: "hero" | "band" | "card";
  className?: string;
};

/**
 * One line of artist facts separated by middots. Each fact is a `dt`/`dd` pair so screen
 * readers hear "Nationality: British" while sighted readers see "British · b. 1956".
 */
export function MarketingArtistFacts({
  facts,
  size = "hero",
  className,
}: MarketingArtistFactsProps) {
  if (facts.length === 0) return null;
  return (
    <dl
      className={cn(
        "flex flex-wrap items-baseline gap-x-2 gap-y-1 font-body text-on-surface-variant",
        size === "hero" && "text-base leading-6 md:text-lg md:leading-7",
        size === "band" &&
          "justify-center text-base leading-6 text-inherit sm:text-xl sm:leading-7",
        size === "card" && "text-sm leading-5",
        className,
      )}
    >
      {facts.map((fact, index) => (
        <div key={fact.label} className="flex items-baseline gap-x-2">
          {index > 0 ? (
            <span aria-hidden className="text-on-surface-variant/70">
              ·
            </span>
          ) : null}
          <dt className="sr-only">{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
