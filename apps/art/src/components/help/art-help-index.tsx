import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { ArtHelpSearchBand } from "@/components/help/art-help-search-band";
import type { ArtEditorialPageResult } from "@/lib/editorial/editorial-pages.composer";
import type { HelpIndexVm } from "@/lib/help/help-pages.composer";
import { HELP_ROUTE } from "@/lib/help/help.vm";
import { FOCUS_RING, MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingChipStrip, MarketingLinkList } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";

type ArtHelpIndexProps = {
  result: ArtEditorialPageResult<HelpIndexVm>;
  /** The raw search term, so the field keeps what was typed when the read fails. */
  query: string;
};

export function ArtHelpIndex({ result, query }: ArtHelpIndexProps) {
  if (result.status !== "ok") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
        <ArtEditorialStatus
          result={result}
          disabledTitle="Help centre unavailable"
          disabledDescription="The Help centre is not enabled in this environment yet."
          emptyTitle="Help centre not found"
          emptyDescription="This page is not available."
          errorTitle="Help centre unavailable"
          errorDescription="We could not load the Help centre. Try again shortly, or contact our team."
        />
      </div>
    );
  }

  const { categories, content } = result.data;
  const browsing = content.kind === "browse";
  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8 pb-10 lg:pb-16")}>
      <ArtHelpSearchBand query={query} titleAs="h1" />
      <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-10">
        {categories.length > 0 ? (
          <nav aria-label="Help categories" className="min-w-0">
            <MarketingChipStrip wrapOnDesktop>
              <HelpChip href={HELP_ROUTE} selected={browsing && content.selectedTitle === null}>
                All questions
              </HelpChip>
              {categories.map((category) => (
                <HelpChip key={category.slug} href={category.href} selected={category.selected}>
                  {category.title}
                  <span className="font-normal opacity-70">{category.count}</span>
                </HelpChip>
              ))}
            </MarketingChipStrip>
          </nav>
        ) : null}
        {content.kind === "search" ? (
          <SearchResults query={query} content={content} />
        ) : (
          <BrowseQuestions content={content} />
        )}
      </div>
    </div>
  );
}

function HelpChip({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      asChild
      variant={selected ? "default" : "outline"}
      size="md"
      className="shrink-0 snap-start rounded-full normal-case"
    >
      <Link
        href={href}
        {...(selected ? { "aria-current": "page" as const } : {})}
        className="art-focus-ring"
      >
        {children}
      </Link>
    </Button>
  );
}

function SearchResults({
  query,
  content,
}: {
  query: string;
  content: Extract<HelpIndexVm["content"], { kind: "search" }>;
}) {
  return (
    <section aria-labelledby="help-results-heading" className="flex flex-col gap-4">
      <h2 id="help-results-heading" className="font-headline text-xl font-semibold text-on-surface">
        {content.summary}
      </h2>
      {content.results.length === 0 ? (
        <ArtStatusState
          variant="empty"
          icon="search-remove"
          title={`No results for “${query}”`}
          description="Check the spelling or try different words, or browse all of our questions."
          actions={
            <>
              <ArtStatusStateLink href={HELP_ROUTE} priority="primary">
                Browse all questions
              </ArtStatusStateLink>
              <ArtStatusStateLink href="/contact">Contact us</ArtStatusStateLink>
            </>
          }
        />
      ) : (
        <ul className="m-0 flex list-none flex-col border-t border-border-hairline p-0">
          {content.results.map((result) => (
            <li key={result.href} className="border-b border-border-hairline">
              <Link
                href={result.href}
                className={cn("group flex min-h-11 flex-col gap-1 py-4", FOCUS_RING)}
              >
                <span className="font-headline text-lg font-medium text-on-surface underline-offset-4 group-hover:underline">
                  {result.question}
                </span>
                <span className="font-label text-xs uppercase tracking-wide text-on-surface-variant">
                  {result.categoryTitle}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BrowseQuestions({
  content,
}: {
  content: Extract<HelpIndexVm["content"], { kind: "browse" }>;
}) {
  if (content.groups.length === 0) {
    return (
      <ArtStatusState
        variant="empty"
        icon="gallery"
        title="No questions yet"
        description="We are still adding answers to common questions. In the meantime, our team is happy to help."
        actions={<ArtStatusStateLink href="/contact">Contact us</ArtStatusStateLink>}
      />
    );
  }
  return (
    <div className="flex flex-col gap-10">
      {content.groups.map((group) => (
        <section
          key={group.slug}
          aria-labelledby={`help-group-${group.slug}`}
          className="flex flex-col gap-4"
        >
          <h2
            id={`help-group-${group.slug}`}
            className="font-headline text-2xl font-semibold text-on-surface"
          >
            {group.title}
          </h2>
          <MarketingLinkList
            ariaLabel={`${group.title} questions`}
            items={group.questions.map((question) => ({
              label: question.question,
              href: question.href,
            }))}
          />
        </section>
      ))}
    </div>
  );
}
