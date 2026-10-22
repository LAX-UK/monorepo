import { AdminRetryButton } from "@/components/admin-retry-button.client";
import type { AdminFetchResult } from "@/server/application/load-admin-data";
import { Alert, AlertDescription, AlertTitle, PageHeader } from "@auction/ui";

export type AdminPageFailureStatus = Exclude<
  AdminFetchResult<unknown>["status"],
  "ok" | "unauthorized"
>;

const COPY: Record<AdminPageFailureStatus, { title: string; body: string }> = {
  forbidden: {
    title: "Access denied",
    body: "Your role cannot view this section.",
  },
  not_found: {
    title: "Not available",
    body: "This section is turned off on this environment.",
  },
  failed: {
    title: "Could not load",
    body: "Something went wrong loading this page. Try again shortly.",
  },
};

export function AdminFetchState({ status }: { status: AdminPageFailureStatus }) {
  const copy = COPY[status];
  return (
    <Alert variant={status === "failed" ? "destructive" : "default"}>
      <AlertTitle className="text-base">{copy.title}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>{copy.body}</p>
        {status === "failed" ? <AdminRetryButton /> : null}
      </AlertDescription>
    </Alert>
  );
}

/** A page whose data could not be loaded: its heading, so staff know where they are, then why. */
export function AdminFailedPage({
  title,
  status,
}: {
  title: string;
  status: AdminPageFailureStatus;
}) {
  return (
    <div>
      <PageHeader title={title} />
      <AdminFetchState status={status} />
    </div>
  );
}
