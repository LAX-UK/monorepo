"use client";

import {
  type CatalogueImageOrigins,
  type CatalogueImageResolver,
  createCatalogueImageResolver,
} from "@auction/shop-contracts";
import { type ReactNode, createContext, useContext, useMemo } from "react";

const StaffCatalogueImageContext = createContext<CatalogueImageResolver>(
  createCatalogueImageResolver("staff", {}),
);

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
  return (
    <StaffCatalogueImageContext.Provider value={resolve}>
      {children}
    </StaffCatalogueImageContext.Provider>
  );
}

export function useStaffCatalogueImage(): CatalogueImageResolver {
  return useContext(StaffCatalogueImageContext);
}
