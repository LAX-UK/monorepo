import { ArtStoriesIndex } from "@/components/editorial/art-stories-index";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Press | lax.art",
  description: "Press coverage of the London Art Exchange and its artists.",
  alternates: { canonical: "/stories/press" },
};

/**
 * Rendered per request, as before the root layout stopped reading the visitor. Whether this page is
 * prerendered like the home page is decided per route (apps/art/scripts/check-prerendered-routes.mjs).
 */
export const dynamic = "force-dynamic";

export default function PressStoriesPage() {
  return <ArtStoriesIndex tab="press" />;
}
