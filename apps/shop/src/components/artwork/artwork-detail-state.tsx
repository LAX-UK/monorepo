import type { LaxIllustrationName } from "@auction/ui/components/lax-illustration";
import { EmptyState } from "@auction/ui/lax/empty-state";
import Link from "next/link";
import type { ReactNode } from "react";

type ArtworkDetailStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  /** The LAX drawing: `ticket` for not found, `askew` for the error boundary. */
  illustration: LaxIllustrationName;
  /** What to do next (a retry, a link), in the copy column under the description. */
  actions?: ReactNode;
  /** Related content under the whole state, such as other editions. */
  children?: ReactNode;
};

/** A detail page that has nothing to show: the shared empty state, with what to do next below. */
export function ArtworkDetailState({
  eyebrow,
  title,
  description,
  illustration,
  actions,
  children,
}: ArtworkDetailStateProps) {
  return (
    <main id="main-content" className="shop-page shop-page--detail">
      <Link href="/" className="shop-detail__back shop-focus-ring">
        ← Back to Collect
      </Link>
      <EmptyState
        layout="page"
        illustration={illustration}
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={actions}
      />
      {children}
    </main>
  );
}
