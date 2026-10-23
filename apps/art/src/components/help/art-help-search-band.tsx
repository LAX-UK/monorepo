import { HELP_ROUTE } from "@/lib/help/help.vm";
import { MarketingCloseIcon, MarketingSearchIcon } from "@auction/marketing-ui";
import { HELP_SEARCH_MAX_LENGTH } from "@auction/shop-contracts";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import Link from "next/link";

type ArtHelpSearchBandProps = {
  /** The term in the URL, shown in the field. */
  query: string;
  /** The index owns the page's `h1`; on an answer page the question does, so the band is a paragraph. */
  titleAs: "h1" | "p";
};

/**
 * "Find your answer here" title and search field that open every Help page (Figma `923:13696`).
 * A plain GET form, so search works before hydration and without JavaScript.
 */
export function ArtHelpSearchBand({ query, titleAs: Title }: ArtHelpSearchBandProps) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-8 px-4 py-8 text-center lg:min-h-[300px]">
      <Title className="font-headline text-[length:var(--text-title-section)] font-semibold leading-[1.2] text-on-surface">
        Find your answer here
      </Title>
      <search className="w-full max-w-[700px]">
        <form action={HELP_ROUTE} method="get" className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Label htmlFor="help-search-query" className="sr-only">
              Search the Help centre
            </Label>
            <MarketingSearchIcon className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <Input
              id="help-search-query"
              name="q"
              type="search"
              variant="underline"
              enterKeyHint="search"
              defaultValue={query}
              maxLength={HELP_SEARCH_MAX_LENGTH}
              placeholder="Search"
              autoComplete="off"
              className="h-16 pl-12 text-left font-body text-lg [&::-webkit-search-cancel-button]:hidden"
              data-testid="help-search-input"
            />
          </div>
          {query ? (
            <Button asChild variant="ghost" size="icon" className="shrink-0 rounded-full">
              <Link href={HELP_ROUTE} aria-label="Clear search" className="art-focus-ring">
                <MarketingCloseIcon />
              </Link>
            </Button>
          ) : null}
          <Button type="submit" variant="cta" size="md" className="shrink-0 font-label uppercase">
            Search
          </Button>
        </form>
      </search>
    </div>
  );
}
