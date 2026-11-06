"use client";

import { type LotMediaLayout, lotMediaPlan } from "@/lib/lot-page/lot-media-plan";
import type { DepartmentDisplayStyle } from "@auction/domain";
import type { GalleryImage } from "@auction/types";
import dynamic from "next/dynamic";
import { type ComponentType, useState } from "react";
import { AnglesView } from "./angles-view";
import type { LotMediaViewProps } from "./lot-media-parts";
import { SideBySideView } from "./side-by-side-view";
import { SingleView } from "./single-view";
import { SwipeView } from "./swipe-view";

const GalleryLightbox = dynamic(
  () => import("@/components/gallery/engine/gallery-lightbox").then((m) => m.GalleryLightbox),
  { ssr: false },
);

/** One presentation per layout: a layout is added here, not in an if-chain. */
const VIEWS: Record<LotMediaLayout, ComponentType<LotMediaViewProps>> = {
  single: SingleView,
  angles: (props) => <AnglesView {...props} mode="contain" />,
  "angles-zoom": (props) => <AnglesView {...props} mode="fill" />,
  faces: (props) => <SideBySideView {...props} mode="faces" />,
  swipe: SwipeView,
  spread: (props) => <SideBySideView {...props} mode="spread" />,
};

type Props = {
  title: string;
  images: GalleryImage[];
  /** The lot's department style; a wall work by default. */
  displayStyle?: DepartmentDisplayStyle;
  /** Two pictures are the two faces of one piece (coins and medals). */
  pairsTwoFaces?: boolean;
};

/**
 * The picture area of a lot page. The department's display style picks how the pictures are
 * presented (see `lotMediaPlan`); every presentation shares the strip of thumbnails and the
 * full-screen viewer with zoom.
 */
export function LotMedia({ title, images, displayStyle = "wall", pairsTwoFaces = false }: Props) {
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const plan = lotMediaPlan(displayStyle, images.length, { pairsTwoFaces });
  const View = VIEWS[plan.layout];

  return (
    <div className="min-w-0" data-media-layout={plan.layout}>
      <View
        title={title}
        images={images}
        index={index}
        onIndexChange={setIndex}
        onOpenViewer={(at) => {
          if (at !== undefined) setIndex(at);
          setViewerOpen(true);
        }}
        stripLabel={plan.stripLabel}
      />
      {viewerOpen ? (
        <GalleryLightbox
          images={images}
          index={index}
          open={viewerOpen}
          onIndexChange={setIndex}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </div>
  );
}
