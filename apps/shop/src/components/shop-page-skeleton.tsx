export type ShopPageSkeletonVariant = "catalogue" | "detail" | "commerce";

type ShopPageSkeletonProps = {
  variant: ShopPageSkeletonVariant;
};

const SKELETON_CARD_PLACEHOLDERS = ["a", "b", "c", "d", "e", "f"] as const;

function ShopSkeletonBar({ className }: { className?: string }) {
  return <span className={["shop-skeleton__bar", className].filter(Boolean).join(" ")} />;
}

function CatalogueSkeleton() {
  return (
    <div className="shop-skeleton shop-skeleton--catalogue" aria-busy="true" aria-live="polite">
      <ShopSkeletonBar className="shop-skeleton__bar--title" />
      <ShopSkeletonBar className="shop-skeleton__bar--lead" />
      <div className="shop-skeleton__toolbar">
        <ShopSkeletonBar className="shop-skeleton__bar--field" />
        <ShopSkeletonBar className="shop-skeleton__bar--field" />
        <ShopSkeletonBar className="shop-skeleton__bar--field" />
      </div>
      <ul className="shop-skeleton__grid">
        {SKELETON_CARD_PLACEHOLDERS.map((key) => (
          <li key={key} className="shop-skeleton__card">
            <span className="shop-skeleton__media" />
            <ShopSkeletonBar className="shop-skeleton__bar--card-title" />
            <ShopSkeletonBar className="shop-skeleton__bar--card-meta" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="shop-skeleton shop-skeleton--detail" aria-busy="true" aria-live="polite">
      <ShopSkeletonBar className="shop-skeleton__bar--back" />
      <div className="shop-skeleton__detail">
        <span className="shop-skeleton__detail-media" />
        <div className="shop-skeleton__detail-copy">
          <ShopSkeletonBar className="shop-skeleton__bar--eyebrow" />
          <ShopSkeletonBar className="shop-skeleton__bar--detail-title" />
          <ShopSkeletonBar className="shop-skeleton__bar--lead" />
          <ShopSkeletonBar className="shop-skeleton__bar--section" />
          <ShopSkeletonBar className="shop-skeleton__bar--section" />
        </div>
      </div>
    </div>
  );
}

function CommerceSkeleton() {
  return (
    <div className="shop-skeleton shop-skeleton--commerce" aria-busy="true" aria-live="polite">
      <ShopSkeletonBar className="shop-skeleton__bar--title" />
      <div className="shop-skeleton__commerce-panel">
        <ShopSkeletonBar className="shop-skeleton__bar--section" />
        <ShopSkeletonBar className="shop-skeleton__bar--section" />
        <ShopSkeletonBar className="shop-skeleton__bar--section" />
      </div>
      <ShopSkeletonBar className="shop-skeleton__bar--action" />
    </div>
  );
}

export function ShopPageSkeleton({ variant }: ShopPageSkeletonProps) {
  if (variant === "detail") return <DetailSkeleton />;
  if (variant === "commerce") return <CommerceSkeleton />;
  return <CatalogueSkeleton />;
}
