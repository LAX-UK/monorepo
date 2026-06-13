"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const LotGalleryDynamic = dynamic(
  () => import("@/components/gallery/lot-gallery").then((mod) => ({ default: mod.LotGallery })),
  { ssr: false },
);

export function LotGalleryLazy(props: ComponentProps<typeof LotGalleryDynamic>) {
  return <LotGalleryDynamic {...props} />;
}
