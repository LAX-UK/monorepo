import type { PrivateSaleHighlightVM } from "@/components/sections/home/home-view-models";
import { PrivateSaleHighlightsMarketing } from "./private-sale-highlights-marketing";

type Props = {
  highlights: PrivateSaleHighlightVM[];
};

/** Server entry for the home “Private Sale Highlights” band. */
export function LaxPrivateSaleHighlightsMarketing({ highlights }: Props) {
  if (highlights.length === 0) return null;
  return <PrivateSaleHighlightsMarketing highlights={highlights} />;
}
