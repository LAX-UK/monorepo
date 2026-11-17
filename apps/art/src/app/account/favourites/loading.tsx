import { ArtFavouritesSkeleton } from "@/components/layout/art-route-skeletons";

/**
 * Saves and Follows are sibling routes under this segment. Without a boundary here, a tab tapped
 * while the page is still hydrating could leave Next's router waiting forever for the new tab.
 */
export default function Loading() {
  return <ArtFavouritesSkeleton />;
}
