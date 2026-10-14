import { isShopMerchandiseEnabled } from "@/lib/shop-runtime-flags";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/** Runs outside the segment's loading boundary so a disabled flag returns HTTP 404, not a streamed 200. */
export default function MerchandiseLayout({ children }: { children: ReactNode }) {
  if (!isShopMerchandiseEnabled()) {
    notFound();
  }
  return children;
}
