import { ArtHelpIndex } from "@/components/help/art-help-index";
import { artServices } from "@/lib/art-services.server";
import { composeHelpIndexPage } from "@/lib/help/help-pages.composer";
import { type HelpSearchParams, parseHelpParams } from "@/lib/help/help.vm";
import { NOINDEX_ROBOTS } from "@/lib/seo/art-indexing";
import type { Metadata } from "next";

type HelpPageProps = {
  searchParams: Promise<HelpSearchParams>;
};

export async function generateMetadata({ searchParams }: HelpPageProps): Promise<Metadata> {
  const { q, category } = parseHelpParams(await searchParams);
  return {
    title: "Help centre | LAX Art",
    description:
      "Answers to common questions about buying, delivery, returns, private viewings and your LAX account.",
    alternates: { canonical: "/help" },
    // Search results and category filters are views of the same questions, not pages of their own.
    ...(q || category ? { robots: NOINDEX_ROBOTS } : {}),
  };
}

export default async function HelpPage({ searchParams }: HelpPageProps) {
  const state = parseHelpParams(await searchParams);
  const result = await composeHelpIndexPage(artServices, state);
  return <ArtHelpIndex result={result} query={state.q} />;
}
