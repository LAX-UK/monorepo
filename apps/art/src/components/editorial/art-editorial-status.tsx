import { ArtStatusState } from "@/components/art-status-state";
import type { ArtEditorialFetchResult } from "@/lib/editorial/art-editorial.types";

type ArtEditorialStatusProps = {
  result: ArtEditorialFetchResult<unknown>;
  disabledTitle: string;
  disabledDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  errorTitle?: string;
  errorDescription?: string;
};

export function ArtEditorialStatus({
  result,
  disabledTitle,
  disabledDescription,
  emptyTitle,
  emptyDescription,
  errorTitle = "Content unavailable",
  errorDescription = "We could not load this page. Try again shortly.",
}: ArtEditorialStatusProps) {
  if (result.status === "disabled") {
    return (
      <ArtStatusState
        variant="empty"
        layout="page"
        titleAs="h1"
        title={disabledTitle}
        description={disabledDescription}
      />
    );
  }
  if (result.status === "error") {
    return (
      <ArtStatusState
        variant="error"
        layout="page"
        titleAs="h1"
        title={errorTitle}
        description={errorDescription}
      />
    );
  }
  if (result.status === "not_found") {
    return (
      <ArtStatusState
        variant="empty"
        layout="page"
        titleAs="h1"
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }
  return null;
}
