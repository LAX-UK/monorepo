import { SEARCH_QUERY_MAX_LENGTH } from "@/lib/search/search-params";
import { MarketingCloseIcon, MarketingSearchIcon } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import Link from "next/link";

type ArtSearchFormProps = {
  defaultValue: string;
  className?: string;
};

/**
 * Pill search field (Figma `886:18755`). A plain GET form so search works before hydration and
 * without JavaScript; clearing is a link back to the empty search page for the same reason.
 */
export function ArtSearchForm({ defaultValue, className }: ArtSearchFormProps) {
  return (
    <form action="/search" method="get" className={cn("flex w-full items-center gap-3", className)}>
      <div className="relative min-w-0 flex-1">
        <Label htmlFor="art-search-query" className="sr-only">
          Search artists, artworks, exhibitions and stories
        </Label>
        <MarketingSearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <Input
          id="art-search-query"
          name="q"
          type="search"
          enterKeyHint="search"
          defaultValue={defaultValue}
          maxLength={SEARCH_QUERY_MAX_LENGTH}
          placeholder="Search artist or artwork"
          autoComplete="off"
          className={cn(
            "min-h-14 w-full rounded-full border-transparent bg-surface-container pl-12 font-body text-base",
            defaultValue ? "pr-14" : "pr-5",
            "[&::-webkit-search-cancel-button]:hidden",
          )}
          data-testid="art-search-input"
        />
        {defaultValue ? (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1/2 size-11 -translate-y-1/2 rounded-full text-on-surface-variant"
          >
            <Link href="/search" aria-label="Clear search" className="art-focus-ring">
              <MarketingCloseIcon />
            </Link>
          </Button>
        ) : null}
      </div>
      <Button type="submit" className="hidden min-h-11 font-label lg:inline-flex">
        Search
      </Button>
    </form>
  );
}
