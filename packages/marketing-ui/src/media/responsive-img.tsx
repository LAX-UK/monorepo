"use client";

import { type ImgHTMLAttributes, type SyntheticEvent, useState } from "react";

export type ResponsiveImgProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet" | "alt"
> & {
  src: string;
  /** Empty for a picture the surrounding text already names. */
  alt: string;
  /** The resized files to choose from (see `nextImageSrcSet`); empty means the original only. */
  srcSet?: string | undefined;
  /** Called once, with the address, when the resized files were refused and the original took over. */
  onFallback?: ((src: string) => void) | undefined;
};

/**
 * A plain `<img>` that names resized files. If the image route refuses them (a host it does not
 * know, a picture it cannot read), it falls back once to the original address before reporting
 * the error, so a resize problem can never cost a picture its place.
 */
export function ResponsiveImg({
  src,
  alt,
  srcSet,
  sizes,
  onError,
  onFallback,
  ...rest
}: ResponsiveImgProps) {
  const [original, setOriginal] = useState(false);
  const resized = !original && srcSet ? srcSet : undefined;
  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (resized) {
      setOriginal(true);
      onFallback?.(src);
    } else onError?.(event);
  };
  return (
    <img
      {...rest}
      src={src}
      alt={alt}
      srcSet={resized}
      sizes={resized ? sizes : undefined}
      onError={handleError}
    />
  );
}
