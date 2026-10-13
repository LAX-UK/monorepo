import { ArtPageHeader } from "@/components/art-page-header";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import type {
  ArtEditorialPageResult,
  EditorialPageVm,
} from "@/lib/editorial/editorial-pages.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";

export type ArtEditorialPageViewProps = {
  result: ArtEditorialPageResult<EditorialPageVm>;
  /** Path this route serves for the API's slug; other canonical paths redirect permanently. */
  routeFor: (slug: string) => string;
  breadcrumbs?: { label: string; href?: string }[];
  /** Call to action rendered after the body (e.g. enquiry panel). */
  aside?: ReactNode;
  /** Slug routes 404 when editorial is off; fixed guide routes keep a "coming soon" state. */
  notFoundWhenDisabled?: boolean;
};

/** Shared renderer for guide, legal and Collector Hub service pages. */
export function ArtEditorialPageView({
  result,
  routeFor,
  breadcrumbs,
  aside,
  notFoundWhenDisabled = false,
}: ArtEditorialPageViewProps) {
  if (result.status === "not_found") notFound();
  if (result.status === "disabled" && notFoundWhenDisabled) notFound();
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

  return (
    <article className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8 py-6 lg:py-10")}>
      <ArtPageHeader
        title={result.data.title}
        {...(breadcrumbs ? { breadcrumbs: [...breadcrumbs, { label: result.data.title }] } : {})}
      />
      <EditorialBlockRenderer body={result.data.body} className="max-w-3xl" />
      {aside ? (
        <div className="flex max-w-3xl flex-col gap-3 border-t border-border-hairline pt-8">
          {aside}
        </div>
      ) : null}
    </article>
  );
}

export function editorialPageMetadata(
  result: ArtEditorialPageResult<EditorialPageVm>,
  fallbackTitle: string,
): Metadata {
  if (result.status !== "ok") {
    return { title: `${fallbackTitle} | LAX Art`, robots: { index: false, follow: false } };
  }
  return {
    title: `${result.data.title} | LAX Art`,
    alternates: { canonical: result.data.canonicalPath },
  };
}
