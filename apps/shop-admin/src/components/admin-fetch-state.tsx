import { AdminRetryButton } from "@/components/admin-retry-button.client";
import type { AdminFetchResult } from "@/server/application/load-admin-data";
import { EmptyState, ErrorState, PageHeader } from "@auction/staff-ui";

export type AdminPageFailureStatus = Exclude<
  AdminFetchResult<unknown>["status"],
  "ok" | "unauthorized"
>;

const COPY: Record<AdminPageFailureStatus, { title: string; body: string }> = {
  forbidden: {
    title: "Your role cannot open this page",
    body: "Ask a LAX Admin administrator if you need access.",
  },
  not_found: {
    title: "Not available here",
    body: "This section is turned off on this environment.",
  },
  failed: {
    title: "This page did not load",
    body: "Something went wrong on our side. Try again in a moment.",
  },
};

export function AdminFetchState({ status }: { status: AdminPageFailureStatus }) {
  const copy = COPY[status];
  return (
    <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
      {status === "failed" ? (
        <ErrorState title={copy.title} description={copy.body} action={<AdminRetryButton />} />
      ) : (
        <EmptyState title={copy.title} description={copy.body} />
      )}
    </div>
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
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <AdminFetchState status={status} />
    </div>
  );
}
