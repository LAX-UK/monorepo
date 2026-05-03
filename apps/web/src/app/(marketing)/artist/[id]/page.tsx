import { getServerArtistById } from "@/lib/data/http/artist.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { metadataForNotFound, metadataForSeller } from "@/lib/seo/metadata-factory";
import { artistPath } from "@/lib/seo/url";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const artist = await getServerArtistById(id);
  if (artist) {
    return {
      ...metadataForSeller(artist),
      robots: { index: false, follow: true },
    };
  }
  const user = await getServerPublicUserReader()
    .then((reader) => reader.getById(id))
    .catch(() => null);
  if (!user) return metadataForNotFound("Artist not found");
  return {
    ...metadataForSeller(user),
    robots: { index: false, follow: true },
  };
}

export default async function ArtistLegacyRedirect({ params }: PageProps) {
  const { id } = await params;
  const artist = await getServerArtistById(id);
  if (artist) permanentRedirect(artistPath(artist));
  const user = await getServerPublicUserReader()
    .then((reader) => reader.getById(id))
    .catch(() => null);
  if (!user) notFound();
  permanentRedirect(artistPath(user));
}
