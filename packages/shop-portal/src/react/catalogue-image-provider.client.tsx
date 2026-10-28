"use client";

import {
  type CatalogueImageOrigins,
  type CatalogueImageViewer,
  createCatalogueImageResolver,
} from "@auction/shop-contracts";
import { ImageSrcResolverProvider } from "@auction/ui/lib/image-src-context";
import { type ReactNode, useMemo } from "react";

export type CatalogueImageProviderProps = {
  viewer: Exclude<CatalogueImageViewer, "staff">;
  origins: CatalogueImageOrigins;
  children: ReactNode;
};

/** Gives every catalogue image beneath it the storefront-aware URL rules of `viewer`. */
export function CatalogueImageProvider({ viewer, origins, children }: CatalogueImageProviderProps) {
  const { shop, art } = origins;
  const resolve = useMemo(
    () => createCatalogueImageResolver(viewer, { shop, art }),
    [viewer, shop, art],
  );
  return <ImageSrcResolverProvider resolve={resolve}>{children}</ImageSrcResolverProvider>;
}
