import { type CoverPhotoMedia, photoFromCover } from "@auction/marketing-ui";
import type { PublicHomeCover } from "@auction/shop-contracts";

/** What reads the picture staff chose; the home depends on this, not on how it is fetched. */
export type StaffCoverReader = () => Promise<PublicHomeCover>;

/**
 * The picture staff chose to lead the home, ready for the cover, or null: none chosen, one that
 * cannot carry the type, or the read failed. The home then leads exactly as it does without one,
 * so this never makes the first screen worse.
 */
export async function readStaffCover(read: StaffCoverReader): Promise<CoverPhotoMedia | null> {
  try {
    const { cover } = await read();
    return cover ? photoFromCover({ default: cover }) : null;
  } catch {
    return null;
  }
}
