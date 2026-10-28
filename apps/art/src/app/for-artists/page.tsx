import { ForArtistsPage } from "@/components/artist-application/for-artists-page";
import {
  FOR_ARTISTS_CONTENT,
  FOR_ARTISTS_PATH,
} from "@/lib/artist-application/for-artists.content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For artists | lax.art",
  description: FOR_ARTISTS_CONTENT.subtitle,
  alternates: { canonical: FOR_ARTISTS_PATH },
};

export default function ForArtistsRoute() {
  return <ForArtistsPage />;
}
