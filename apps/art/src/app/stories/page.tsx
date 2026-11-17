import { ArtStoriesIndex } from "@/components/editorial/art-stories-index";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "All stories | lax.art",
  description: "Stories, films, podcast episodes and press from the London Art Exchange gallery.",
  alternates: { canonical: "/stories" },
};

/**
 * Rendered per request, as before the root layout stopped reading the visitor. Whether this page is
 * prerendered like the home page is decided per route (apps/art/scripts/check-prerendered-routes.mjs).
 */
export const dynamic = "force-dynamic";

export default function StoriesPage() {
  return <ArtStoriesIndex tab="all" />;
}
