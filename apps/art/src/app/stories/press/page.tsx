import { ArtStoriesIndex } from "@/components/editorial/art-stories-index";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Press | lax.art",
  description: "Press coverage of the London Art Exchange and its artists.",
  alternates: { canonical: "/stories/press" },
};

export default function PressStoriesPage() {
  return <ArtStoriesIndex tab="press" />;
}
