import { nextImageSrcSet } from "@auction/marketing-ui";

/*
 * The resized files the Shop names for a cover picture drawn across the page. Every width is one
 * of Next's default `images.deviceSizes`, which the image route accepts.
 */
const COVER_WIDTHS = [640, 828, 1080, 1200, 1920, 2048] as const;

/** A `srcset` for a cover picture and its own width; empty when it cannot be resized. */
export function shopCoverSrcSet(src: string | null | undefined, maxWidth?: number | null): string {
  return nextImageSrcSet(src, COVER_WIDTHS, { maxWidth });
}
