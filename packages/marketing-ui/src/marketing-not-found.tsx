import type { LaxIllustrationName } from "@auction/ui/components/lax-illustration";
import { Button, ButtonLink, EmptyState, TextInput } from "@auction/ui/lax";
import { Search } from "lucide-react";
import type { ElementType, ReactNode } from "react";

export type MarketingNotFoundLink = { href: string; label: string };

/** The search field of a not-found page: a plain GET form, so it works without scripts. */
export type MarketingNotFoundSearch = {
  /** Where the form submits, for example `/search`. */
  action: string;
  /** The query parameter the destination reads. Defaults to `q`. */
  name?: string;
  /** What the field is called for assistive technology. */
  label: string;
  /** Defaults to the label. */
  placeholder?: string;
};

export type MarketingNotFoundProps = {
  title: string;
  description: string;
  /** The drawing on the paper plate. */
  illustration: LaxIllustrationName;
  /** Replaces the drawing, for a plate that is not a drawing (a lot's hatched placeholder). */
  plate?: ReactNode;
  /** Shown when the visitor's intent is unknown, so searching comes first. */
  search?: MarketingNotFoundSearch;
  /** The first link is the primary action, unless a search field is shown. */
  links: readonly MarketingNotFoundLink[];
  /** Replaces the links, for a product whose primary action has its own button. */
  actions?: ReactNode;
  /** The product's link component (`next/link`); a plain anchor when left out. */
  Link?: ElementType;
  className?: string;
};

function NotFoundSearch({ search }: { search: MarketingNotFoundSearch }) {
  return (
    <form action={search.action} method="get" aria-label={search.label}>
      <div className="flex gap-2">
        <TextInput
          name={search.name ?? "q"}
          type="search"
          size="lg"
          aria-label={search.label}
          placeholder={search.placeholder ?? search.label}
          autoComplete="off"
          enterKeyHint="search"
          leading={<Search aria-hidden className="size-4" />}
          boxClassName="min-w-0 flex-1"
        />
        <Button type="submit" variant="primary" size="lg">
          Search
        </Button>
      </div>
    </form>
  );
}

function NotFoundLinks({
  links,
  Link,
  hasSearch,
}: {
  links: readonly MarketingNotFoundLink[];
  Link: ElementType | undefined;
  hasSearch: boolean;
}) {
  const linkProps = Link ? { Link } : {};
  return (
    <>
      {links.map((link, index) => (
        <ButtonLink
          key={link.href}
          {...linkProps}
          href={link.href}
          // One route per row on a phone, so a longer label keeps its padding.
          className="max-sm:min-w-full"
          variant={index === 0 && !hasSearch ? "primary" : "secondary"}
        >
          {link.label}
        </ButtonLink>
      ))}
    </>
  );
}

/**
 * The one not-found page of the LAX family: a drawing on a paper plate beside the page's h1, one
 * sentence, an optional search field and at most three routes onward. Each product renders it
 * inside its own shell and passes its own words, search and links; the shell owns the page's main
 * landmark, so this is a section of it.
 */
export function MarketingNotFound({
  title,
  description,
  illustration,
  plate,
  search,
  links,
  actions,
  Link,
  className,
}: MarketingNotFoundProps) {
  return (
    <EmptyState
      layout="page"
      {...(className ? { className } : {})}
      illustration={illustration}
      title={title}
      description={description}
      {...(plate ? { plate } : {})}
      {...(search ? { control: <NotFoundSearch search={search} /> } : {})}
      actions={actions ?? <NotFoundLinks links={links} Link={Link} hasSearch={Boolean(search)} />}
    />
  );
}
