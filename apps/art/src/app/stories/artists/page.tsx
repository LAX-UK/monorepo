import { ArtStoriesIndex } from "@/components/editorial/art-stories-index";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Artist stories and films | lax.art",
  description:
    "Conversations, studio visits and films with the artists shown at the London Art Exchange.",
  alternates: { canonical: "/stories/artists" },
};

/**
 * Rendered per request, as before the root layout stopped reading the visitor. Whether this page is
 * prerendered like the home page is decided per route (apps/art/scripts/check-prerendered-routes.mjs).
 */
export const dynamic = "force-dynamic";

export default function ArtistStoriesPage() {
  return <ArtStoriesIndex tab="artists" />;
}
