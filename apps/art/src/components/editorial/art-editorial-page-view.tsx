import { ArtPageHeader } from "@/components/art-page-header";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import type {
  ArtEditorialPageResult,
  EditorialPageVm,
} from "@/lib/editorial/editorial-pages.composer";
import { notFoundOrUnavailable } from "@/lib/seo/page-status";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingPageTitle, type MarketingPageTitleChip } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";

export type ArtEditorialPageViewProps = {
  result: ArtEditorialPageResult<EditorialPageVm>;
  /** Path this route serves for the API's slug; other canonical paths redirect permanently. */
  routeFor: (slug: string) => string;
  breadcrumbs?: { label: string; href?: string }[];
  /**
   * Figma's centred page title band (875:19061) instead of the breadcrumb header, for pages that
   * have a Figma frame; others keep `ArtPageHeader`.
   */
  titleBand?: { subtitle?: string; chip?: MarketingPageTitleChip };
  /** Call to action rendered after the body (e.g. enquiry panel). */
  aside?: ReactNode;
  /** Full-width section between the body and `aside` (e.g. the guide card grid). */
  afterBody?: ReactNode;
  /** Slug routes 404 when editorial is off; fixed guide routes keep a "coming soon" state. */
  notFoundWhenDisabled?: boolean;
};

/** Shared renderer for guide, legal and Collector Hub service pages. */
export function ArtEditorialPageView({
  result,
  routeFor,
  breadcrumbs,
  titleBand,
  aside,
  afterBody,
  notFoundWhenDisabled = false,
}: ArtEditorialPageViewProps) {
  if (result.status !== "ok" && (result.status !== "disabled" || notFoundWhenDisabled)) {
    notFoundOrUnavailable(result.status, "Page");
  }
  if (result.status !== "ok") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
        <ArtEditorialStatus
          result={result}
          disabledTitle="Page unavailable"
          disabledDescription="Editorial pages are not enabled in this environment yet."
          emptyTitle="Page not found"
          emptyDescription="This page is not available."
        />
      </div>
    );
  }
  if (result.data.canonicalPath !== routeFor(result.data.slug)) {
    permanentRedirect(result.data.canonicalPath);
  }

  // The centred band reads best over a centred column.
  const column = titleBand ? "mx-auto w-full max-w-3xl" : "max-w-3xl";
  return (
    <article
      className={cn(
        MARKETING_PAGE_SHELL,
        "flex flex-col gap-8",
        titleBand ? "pb-10 lg:pb-16" : "py-6 lg:py-10",
      )}
    >
      {titleBand ? (
        <MarketingPageTitle title={result.data.title} {...titleBand} />
      ) : (
        <ArtPageHeader
          title={result.data.title}
          {...(breadcrumbs ? { breadcrumbs: [...breadcrumbs, { label: result.data.title }] } : {})}
        />
      )}
      <EditorialBlockRenderer body={result.data.body} className={column} />
      {afterBody}
      {aside ? (
        <div className={cn(column, "flex flex-col gap-3 border-t border-border-hairline pt-8")}>
          {aside}
        </div>
      ) : null}
    </article>
  );
}

export function editorialPageMetadata(
  result: ArtEditorialPageResult<EditorialPageVm>,
  fallbackTitle: string,
  { notFoundWhenDisabled = false }: { notFoundWhenDisabled?: boolean } = {},
): Metadata {
  if (result.status === "disabled" && !notFoundWhenDisabled) {
    return { title: `${fallbackTitle} | lax.art`, robots: { index: false, follow: false } };
  }
  if (result.status !== "ok") notFoundOrUnavailable(result.status, fallbackTitle);
  return {
    title: result.data.metaTitle,
    ...(result.data.metaDescription ? { description: result.data.metaDescription } : {}),
    alternates: { canonical: result.data.canonicalPath },
  };
}
