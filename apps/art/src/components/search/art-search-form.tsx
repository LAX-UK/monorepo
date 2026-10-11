import { SEARCH_QUERY_MAX_LENGTH } from "@/lib/search/search-page.composer";
import { MarketingSearchIcon } from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";

/** Plain GET form so search works before hydration and without JavaScript. */
export function ArtSearchForm({ defaultValue }: { defaultValue: string }) {
  return (
    <form action="/search" method="get" className="flex max-w-2xl gap-2">
      <Label htmlFor="art-search-query" className="sr-only">
        Search artworks and artists
      </Label>
      <Input
        id="art-search-query"
        name="q"
        type="search"
        defaultValue={defaultValue}
        maxLength={SEARCH_QUERY_MAX_LENGTH}
        placeholder="Search title or artist"
        autoComplete="off"
        className="min-h-11 flex-1"
        data-testid="art-search-input"
      />
      <Button type="submit" className="min-h-11 font-label uppercase tracking-wide">
        <MarketingSearchIcon aria-hidden className="size-4" />
        Search
      </Button>
    </form>
  );
}
