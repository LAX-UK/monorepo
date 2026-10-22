import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import { ArtHelpSearchBand } from "@/components/help/art-help-search-band";
import type { HelpArticlePageVm } from "@/lib/help/help-pages.composer";
import { HELP_ROUTE } from "@/lib/help/help.vm";
import { FOCUS_RING, MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@auction/ui/components/breadcrumb";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

/** A single answer (Figma `923:13696`): question, answer, and the rest of its category beside it. */
export function ArtHelpArticle({ page }: { page: HelpArticlePageVm }) {
  const { article, body, categoryHref, related } = page;
  return (
    <article className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8 pb-10 lg:pb-16")}>
      <ArtHelpSearchBand query="" titleAs="p" />
      <div className="flex flex-col gap-10">
        <Breadcrumb>
          <BreadcrumbList className="text-sm">
            <BreadcrumbItem>
              <BreadcrumbLink asChild className="rounded-sm art-focus-ring">
                <Link href={HELP_ROUTE}>Help centre</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                className="rounded-sm font-semibold text-on-surface art-focus-ring"
              >
                <Link href={categoryHref}>{article.categoryTitle}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div
          className={cn(
            "grid gap-10 lg:gap-0",
            related.length > 0 && "lg:grid-cols-[minmax(0,1fr)_400px]",
          )}
        >
          <div className="flex min-w-0 flex-col gap-10 lg:pr-10">
            <h1 className="font-headline text-[length:var(--text-title-section)] font-semibold leading-[1.2] text-on-surface">
              {article.question}
            </h1>
            <EditorialBlockRenderer body={body} className="max-w-none" />
            <div className="flex flex-col items-start gap-3">
              <p className="font-body text-base text-on-surface-variant">Still need help?</p>
              <Button asChild variant="cta" size="lg">
                <Link href="/contact" className="art-focus-ring">
                  Contact us
                </Link>
              </Button>
            </div>
          </div>
          {related.length > 0 ? (
            <aside
              aria-labelledby="help-related-heading"
              className="flex flex-col gap-8 border-t border-border-hairline pt-8 lg:border-l lg:border-t-0 lg:pl-[60px] lg:pt-0"
            >
              <h2
                id="help-related-heading"
                className="font-headline text-2xl font-semibold text-on-surface"
              >
                {article.categoryTitle}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {related.map((question) => (
                  <li key={question.href}>
                    <Link
                      href={question.href}
                      {...(question.current ? { "aria-current": "page" as const } : {})}
                      className={cn(
                        "flex min-h-12 items-center font-headline text-lg underline-offset-4 hover:underline",
                        question.current
                          ? "font-semibold text-on-surface"
                          : "font-medium text-link",
                        FOCUS_RING,
                      )}
                    >
                      {question.question}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </div>
    </article>
  );
}
