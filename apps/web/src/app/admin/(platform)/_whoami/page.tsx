import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { STAFF_OVERVIEW_ACCESS } from "@/lib/navigation/staff-nav-access";

/** Diagnostics: current server session (not linked from nav). */
export default async function AdminWhoamiPage() {
  await requireAdminCapability(STAFF_OVERVIEW_ACCESS, "/admin/_whoami");
  const user = await getServerSessionUser();
  return (
    <main className="mx-auto max-w-2xl p-8 font-mono text-sm">
      <h1 className="mb-4 font-headline text-lg">Session (server)</h1>
      <pre className="overflow-auto rounded-md border border-outline-variant/30 bg-surface-container-low p-4">
        {JSON.stringify(user, null, 2)}
      </pre>
    </main>
  );
}
