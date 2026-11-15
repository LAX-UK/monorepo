import { ArtworkUnlistedState } from "@/components/artwork/artwork-unlisted-state";
import { fetchPublicArtworks } from "@/lib/shop-api.server";

const OTHER_EDITIONS = 4;

/** Still a 404; the page offers the newest editions instead of a dead end. */
export default async function ArtworkNotFound() {
  const list = await fetchPublicArtworks({ limit: OTHER_EDITIONS, sort: "newest" }).catch(
    () => null,
  );
  return <ArtworkUnlistedState editions={list?.items ?? []} />;
}
