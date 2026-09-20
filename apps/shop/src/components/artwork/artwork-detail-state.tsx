import { ShopStateMotif } from "@/components/shop-state-motif";
import type { ShopStateMotifVariant } from "@/components/shop-state-motif";
import Link from "next/link";
import type { ReactNode } from "react";

type ArtworkDetailStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  motif?: ShopStateMotifVariant;
  children?: ReactNode;
};

export function ArtworkDetailState({
  eyebrow,
  title,
  description,
  motif = "empty",
  children,
}: ArtworkDetailStateProps) {
  return (
    <main id="main-content" className="shop-page shop-page--detail">
      <Link href="/" className="shop-detail__back shop-focus-ring">
        ← Back to Collect
      </Link>
      <div className="shop-detail shop-detail--state">
        <div className="shop-detail__media shop-detail__state-media">
          <ShopStateMotif variant={motif} />
        </div>
        <div className="shop-detail__content">
          <div className="shop-detail__heading">
            <p className="shop-detail__eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <p className="shop-detail__state-copy">{description}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
