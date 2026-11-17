import { ArtStoriesIndex } from "@/components/editorial/art-stories-index";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LAX's Podcast | lax.art",
  description: "Episodes of LAX's podcast on art, artists and collecting.",
  alternates: { canonical: "/stories/podcast" },
};

/**
 * Rendered per request, as before the root layout stopped reading the visitor. Whether this page is
 * prerendered like the home page is decided per route (apps/art/scripts/check-prerendered-routes.mjs).
 */
export const dynamic = "force-dynamic";

export default function PodcastStoriesPage() {
  return <ArtStoriesIndex tab="podcast" />;
}
