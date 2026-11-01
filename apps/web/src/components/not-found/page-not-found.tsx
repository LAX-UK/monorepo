import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { Button, ButtonLink, EmptyState, TextInput } from "@auction/ui/lax";
import { Search } from "lucide-react";
import Link from "next/link";
import { NOT_FOUND_COPY, type NotFoundKind } from "./not-found-copy";

/** The search field of the generic 404: the visitor's intent is unknown, so it comes first. */
function NotFoundSearch() {
  return (
    <form action="/search" aria-label="Search lots" className="flex gap-2">
      <TextInput
        name="q"
        type="search"
        size="lg"
        aria-label="Search by artist, title or sale"
        placeholder="Search by artist, title or sale"
        autoComplete="off"
        leading={<Search aria-hidden className="size-4" />}
        boxClassName="min-w-0 flex-1"
      />
      <Button type="submit" variant="primary" size="lg">
        Search
      </Button>
    </form>
  );
}

/**
 * The one 404 layout of the public site, rendered inside the site shell. The shell owns the page's
 * main landmark, so this is a section of it with the page's h1.
 */
export function PageNotFound({ kind }: { kind: NotFoundKind }) {
  const copy = NOT_FOUND_COPY[kind];
  const [primary, ...rest] = copy.links;
  return (
    <EmptyState
      layout="page"
      className="pt-[var(--header-height)]"
      illustration={copy.illustration}
      title={copy.title}
      description={copy.description}
      {...(kind === "lot"
        ? { plate: <MediaPlaceholder label="Lot not found" tone="auto" fill /> }
        : {})}
      {...(copy.search ? { control: <NotFoundSearch /> } : {})}
      actions={
        <>
          {primary ? (
            <ButtonLink
              Link={Link}
              href={primary.href}
              variant={copy.search ? "secondary" : "primary"}
            >
              {primary.label}
            </ButtonLink>
          ) : null}
          {rest.map((link) => (
            <ButtonLink key={link.href} Link={Link} href={link.href} variant="secondary">
              {link.label}
            </ButtonLink>
          ))}
        </>
      }
    />
  );
}
