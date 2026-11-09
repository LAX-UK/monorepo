"use client";

import { reportImageFallback } from "@/lib/observability/report-image-fallback";
import { ResponsiveImg, type ResponsiveImgProps } from "@auction/marketing-ui";

/**
 * Bid's picture: a `ResponsiveImg` that reports a resize fallback. It is a client component so
 * server-rendered sections can use it without passing the report function across the server and
 * client boundary, which React cannot serialise.
 */
export function BidResponsiveImg(props: Omit<ResponsiveImgProps, "onFallback">) {
  return <ResponsiveImg {...props} onFallback={reportImageFallback} />;
}
