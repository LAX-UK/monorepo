import { ArtStoriesIndex } from "@/components/editorial/art-stories-index";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Artist stories and films | lax.art",
  description:
    "Conversations, studio visits and films with the artists shown at the London Art Exchange.",
  alternates: { canonical: "/stories/artists" },
};

export default function ArtistStoriesPage() {
  return <ArtStoriesIndex tab="artists" />;
}
