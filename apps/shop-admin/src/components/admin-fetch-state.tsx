import type { AdminFetchResult } from "@/server/application/load-admin-data";

type AdminPageFailureStatus = Exclude<AdminFetchResult<unknown>["status"], "ok" | "unauthorized">;

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
    <div className="space-y-2 rounded-md border border-outline-variant p-4">
      <h2 className="text-lg font-semibold">{copy.title}</h2>
      <p className="text-sm text-on-surface-variant">{copy.body}</p>
    </div>
  );
}
