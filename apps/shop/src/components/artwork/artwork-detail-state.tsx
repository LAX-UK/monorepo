import type { LaxIllustrationName } from "@auction/ui/components/lax-illustration";
import type { LaxDrawing } from "@auction/ui/lax/drawings";
import { EmptyStateBase } from "@auction/ui/lax/empty-state-base";
import Link from "next/link";
import type { ReactNode } from "react";

type ArtworkDetailStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  /**
   * The one LAX drawing the page shows, imported on its own from `@auction/ui/lax/drawings`
   * (`ticket` for not found, `askew` for the error boundary) so a client boundary does not carry
   * the whole set.
   */
  drawing: { name: LaxIllustrationName; paths: LaxDrawing };
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
  drawing,
  actions,
  children,
}: ArtworkDetailStateProps) {
  return (
    <main id="main-content" className="shop-page shop-page--detail">
      <Link href="/" className="shop-detail__back shop-focus-ring">
        ← Back to Collect
      </Link>
      <EmptyStateBase
        accent
        layout="page"
        drawing={drawing}
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={actions}
      />
      {children}
    </main>
  );
}
