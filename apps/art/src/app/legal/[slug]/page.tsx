import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import { artServices } from "@/lib/art-services.server";
import { composeLegalPage } from "@/lib/editorial/editorial-pages.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

type LegalPageProps = {
  params: Promise<{ slug: string }>;
};

const loadPage = cache((slug: string) => composeLegalPage(artServices, slug));

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadPage(slug);
  if (result.status !== "ok") return { title: "LAX Art" };
  return {
    title: `${result.data.title} | LAX Art`,
    alternates: { canonical: `/legal/${encodeURIComponent(slug)}` },
  };
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { slug } = await params;
  const result = await loadPage(slug);
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
        <ArtEditorialStatus
          result={result}
          disabledTitle="Page unavailable"
          disabledDescription="Legal and editorial pages are not enabled in this environment yet."
          emptyTitle="Page not found"
          emptyDescription="This page is not available."
        />
      </div>
    );
  }

  return (
    <article className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8 py-10")}>
      <h1 className="max-w-3xl font-headline text-3xl font-semibold text-on-surface">
        {result.data.title}
      </h1>
      <EditorialBlockRenderer body={result.data.body} className="max-w-3xl" />
    </article>
  );
}
