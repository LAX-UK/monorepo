"use client";

import type { HomeHangVM } from "@/lib/hang/home-hang";
import { MarketingHang } from "@auction/marketing-ui";
import { toHangProps } from "./to-hang-props";

/**
 * The hang under the home hero: "In this sale" while a sale is live or upcoming, "Recently sold"
 * between sales. The meta line says whether the wall is to scale, so a wall of works with missing
 * sizes is honest about it.
 */
export function HomeHangSection({ hang }: { hang: HomeHangVM | null }) {
  if (!hang) return null;
  return <MarketingHang title={hang.title} headingSize="section" {...toHangProps(hang)} />;
}
