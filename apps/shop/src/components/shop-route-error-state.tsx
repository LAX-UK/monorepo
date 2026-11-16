import { askew } from "@auction/ui/lax/drawings";
import { EmptyStateBase } from "@auction/ui/lax/empty-state-base";
import type { ReactNode } from "react";

type ShopRouteErrorStateProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

/**
 * A route error boundary's state: the shared kit state as the page's h1, drawn askew in the Shop
 * accent. It imports the one drawing it shows, not the set, so every `error.tsx` chunk stays
 * light. Silent like every Shop state on first paint.
 */
export function ShopRouteErrorState({ title, description, actions }: ShopRouteErrorStateProps) {
  return (
    <EmptyStateBase
      accent
      variant="error"
      layout="page"
      drawing={{ name: "askew", paths: askew }}
      title={title}
      description={description}
      actions={actions}
      announcement="none"
    />
  );
}
