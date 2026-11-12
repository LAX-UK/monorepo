import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { MarketingNotFound } from "@auction/marketing-ui/marketing-not-found";
import Link from "next/link";
import { NOT_FOUND_COPY, type NotFoundKind } from "./not-found-copy";

/**
 * Bid's not-found page: the family layout inside the site shell, with Bid's words and routes. The
 * shell owns the page's main landmark, so this is a section of it with the page's h1.
 */
export function PageNotFound({ kind }: { kind: NotFoundKind }) {
  const copy = NOT_FOUND_COPY[kind];
  return (
    <MarketingNotFound
      className="pt-[var(--header-height)]"
      Link={Link}
      illustration={copy.illustration}
      title={copy.title}
      description={copy.description}
      links={copy.links}
      {...(kind === "lot"
        ? { plate: <MediaPlaceholder label="Lot not found" tone="auto" fill /> }
        : {})}
      {...(copy.search
        ? {
            search: {
              action: "/search",
              label: "Search by artist, title or sale",
            },
          }
        : {})}
    />
  );
}
