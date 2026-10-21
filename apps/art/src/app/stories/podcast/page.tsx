import { ArtStoriesIndex } from "@/components/editorial/art-stories-index";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LAX's Podcast | LAX Art",
  description: "Episodes of LAX's podcast on art, artists and collecting.",
  alternates: { canonical: "/stories/podcast" },
};

export default function PodcastStoriesPage() {
  return <ArtStoriesIndex tab="podcast" />;
}
