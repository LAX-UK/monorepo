import { ForArtistsPage } from "@/components/artist-application/for-artists-page";
import { ArtGalleryTeamBand } from "@/components/gallery-team/art-gallery-team-band";
import { artServices } from "@/lib/art-services.server";
import {
  FOR_ARTISTS_CONTENT,
  FOR_ARTISTS_PATH,
} from "@/lib/artist-application/for-artists.content";
import { buildArtGalleryTeam } from "@/lib/gallery-team/art-gallery-team.vm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For artists | lax.art",
  description: FOR_ARTISTS_CONTENT.subtitle,
  alternates: { canonical: FOR_ARTISTS_PATH },
};

export default async function ForArtistsRoute() {
  const viewer = await artServices.viewer.load();
  return (
    <ForArtistsPage
      teamBand={
        <ArtGalleryTeamBand team={buildArtGalleryTeam({ context: "forArtists" })} viewer={viewer} />
      }
    />
  );
}
