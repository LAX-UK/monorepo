import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import type { ArtAccountListState } from "@/lib/account/account-page.composer";
import type { ReactNode } from "react";

export type ArtAccountListStateViewProps<T> = {
  state: ArtAccountListState<T>;
  empty: { title: string; description: string; action?: { href: string; label: string } };
  failedDescription: string;
  children: (items: T[]) => ReactNode;
};

/** Empty, sign-in-again, and failure states shared by account lists. */
export function ArtAccountListStateView<T>({
  state,
  empty,
  failedDescription,
  children,
}: ArtAccountListStateViewProps<T>) {
  switch (state.kind) {
    case "ok":
      return <>{children(state.items)}</>;
    case "empty":
      return (
        <ArtStatusState
          variant="empty"
          title={empty.title}
          description={empty.description}
          {...(empty.action
            ? {
                actions: (
                  <ArtStatusStateLink href={empty.action.href}>
                    {empty.action.label}
                  </ArtStatusStateLink>
                ),
              }
            : {})}
        />
      );
    case "sign_in":
      return (
        <ArtStatusState
          variant="error"
          title="Sign in again"
          description="Your session has ended. Sign in to continue."
          actions={
            <ArtStatusStateLink href={state.loginHref} priority="primary">
              Sign in
            </ArtStatusStateLink>
          }
        />
      );
    case "failed":
      return <ArtStatusState variant="error" title="Unavailable" description={failedDescription} />;
  }
}
