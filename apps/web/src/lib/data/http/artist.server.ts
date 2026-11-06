export type { PublicArtistBrowseParams, SitemapArtist } from "@/lib/data/http/artist.schema";
export {
  fetchArtistsForSitemap,
  fetchPublicArtistAliases,
  fetchPublicArtistBrowse,
  fetchRegistryArtistById,
  registryArtistPageExists,
  getServerArtistById,
  getServerArtistReader,
  fetchArtistBySlug,
  portraitForPublicArtist,
} from "@/lib/data/http/artist.reader";
