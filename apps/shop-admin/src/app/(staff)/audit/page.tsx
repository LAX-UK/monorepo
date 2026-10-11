import { AdminFetchState } from "@/components/admin-fetch-state";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminAuditEntry } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

type AuditList = { items: AdminAuditEntry[]; nextCursor: string | null };

export default async function AuditLogPage() {
  const result = await fetchAdminJson<AuditList>("audit?limit=50");
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Audit log</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Audit log</h1>
      <ul className="space-y-2 text-sm">
        {result.data.items.map((row) => (
          <li key={row.auditId} className="rounded-md border border-outline-variant p-3">
            <span className="font-medium">{row.action}</span> · {row.capability} · {row.targetType}/
            {row.targetId.slice(0, 8)}… · <time dateTime={row.createdAt}>{row.createdAt}</time>
          </li>
        ))}
        {result.data.items.length === 0 ? <li>No audit entries yet.</li> : null}
      </ul>
    </div>
  );
}
