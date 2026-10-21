import { ArtStoriesIndex } from "@/components/editorial/art-stories-index";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Latest stories | LAX Art",
  description: "Stories, films, podcast episodes and press from the London Art Exchange gallery.",
  alternates: { canonical: "/stories" },
};

export default function StoriesPage() {
  return <ArtStoriesIndex tab="all" />;
}
