"use client";

import { type CatalogueImageOrigins, createCatalogueImageResolver } from "@auction/shop-contracts";
import { ImageSrcResolverProvider } from "@auction/ui/lib/image-src-context";
import { type ReactNode, useMemo } from "react";

/**
 * Seed images ship inside the storefronts, so LAX Admin loads each one from the storefront that
 * serves it. Uploads and CDN images are absolute already and pass through.
 */
export function StaffCatalogueImageProvider({
  origins,
  children,
}: {
  origins: CatalogueImageOrigins;
  children: ReactNode;
}) {
  const { shop, art } = origins;
  const resolve = useMemo(() => createCatalogueImageResolver("staff", { shop, art }), [shop, art]);
  return <ImageSrcResolverProvider resolve={resolve}>{children}</ImageSrcResolverProvider>;
}
