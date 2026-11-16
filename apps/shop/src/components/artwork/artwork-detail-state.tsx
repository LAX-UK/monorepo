import { EmptyState } from "@auction/ui/lax/empty-state";
import Link from "next/link";
import type { ReactNode } from "react";

export type ArtworkDetailStateMotif = "empty" | "search" | "bag" | "alert" | "ticket";

const ILLUSTRATIONS = {
  empty: "frame",
  search: "search",
  bag: "parcel",
  alert: "askew",
  ticket: "ticket",
} as const;

type ArtworkDetailStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  motif?: ArtworkDetailStateMotif;
  children?: ReactNode;
};

/** A detail page that has nothing to show: the shared empty state, with what to do next below. */
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
      <p className="shop-detail__eyebrow">{eyebrow}</p>
      <EmptyState
        accent
        layout="page"
        illustration={ILLUSTRATIONS[motif]}
        title={title}
        description={description}
      />
      {children}
    </main>
  );
}
