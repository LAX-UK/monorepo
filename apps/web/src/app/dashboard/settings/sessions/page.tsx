import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SessionsClientPage } from "@/components/settings/sessions-client-page";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { PageHeader } from "@auction/ui/components/page-header";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Active sessions" };

export type SessionRow = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastPasswordAuthAt: string | null;
  isCurrent: boolean;
};

export default async function SessionsPage() {
  // No acting-entity header needed; avoids an extra `/legal-entities/me` resolution on this path.
  const res = await authedServerFetch("/users/me/sessions", {
    cache: "no-store",
    skipActingLegalEntityHeader: true,
  });
  if (res.status === 401) redirect("/login?next=/dashboard/settings/sessions&auth=required");
  if (res.status === 403) {
    const err = (await res.json().catch(() => ({}))) as { code?: string };
    if (err.code === "account_suspended") {
      redirect("/login?session_expired=1");
    }
    redirect("/dashboard?error=sessions&code=forbidden");
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { code?: string };
    const code = typeof err.code === "string" ? err.code : "unknown";
    redirect(`/dashboard?error=sessions&code=${encodeURIComponent(code)}`);
  }

  const body = (await res.json()) as { data: SessionRow[] };

  return (
    <DashboardPage className="mx-auto max-w-xl space-y-8">
      <PageHeader
        title="Active sessions"
        description="Devices currently signed into your account."
        className="border-0 pb-0"
      />
      <SessionsClientPage sessions={body.data} />
    </DashboardPage>
  );
}
