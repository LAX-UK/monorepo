"use client";

import * as React from "react";

export type ImageSrcResolver = (src: string | null | undefined) => string | null;

const passThrough: ImageSrcResolver = (src) => src ?? null;

const ImageSrcResolverContext = React.createContext<ImageSrcResolver>(passThrough);

/**
 * Lets a host app decide how stored image URLs reach the page (for example, rebasing seed paths
 * onto the storefront that serves them) without every image component knowing the rules.
 */
export function ImageSrcResolverProvider({
  resolve,
  children,
}: {
  resolve: ImageSrcResolver;
  children: React.ReactNode;
}) {
  return (
    <ImageSrcResolverContext.Provider value={resolve}>{children}</ImageSrcResolverContext.Provider>
  );
}

export function useImageSrcResolver(): ImageSrcResolver {
  return React.useContext(ImageSrcResolverContext);
}
