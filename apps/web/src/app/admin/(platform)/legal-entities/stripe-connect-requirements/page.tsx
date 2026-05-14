import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getAdminLegalEntitiesWithStripeConnectRequirements } from "@/lib/data/http/admin.server";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AdminStripeConnectRequirementsPage() {
  const user = await requireAuthenticatedUser({
    shell: "staff",
    loginNext: "/admin/legal-entities/stripe-connect-requirements",
  });
  if (!canAccessPlatformAdminRoutes(user.role as UserRole, user.staffRole ?? null)) {
    redirect("/admin");
  }

  let rows: Awaited<ReturnType<typeof getAdminLegalEntitiesWithStripeConnectRequirements>> = [];
  let loadError: string | null = null;
  try {
    rows = await getAdminLegalEntitiesWithStripeConnectRequirements();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load legal entities.";
  }

  return (
    <AdminPanelPage
      title="Stripe Connect requirements"
      description="Legal entities where Stripe Connect currently-due requirements are non-empty (database jsonb array length greater than zero)."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="ctaLink" asChild>
            <Link href="/admin/legal-entities" className="inline-flex items-center gap-1">
              Legal entities
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button variant="ctaLink" asChild>
            <Link href="/admin/impersonation" className="inline-flex items-center gap-1">
              Impersonation
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      }
    >
      {loadError ? (
        <p className="text-sm text-error" role="alert">
          {loadError}
        </p>
      ) : null}

      <Card className="border-outline-variant/15">
        <CardHeader>
          <CardTitle className="font-headline text-lg">{rows.length} entities</CardTitle>
          <CardDescription>
            Open an entity to review verification status and Stripe fields in admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              No entities with outstanding Stripe requirements.
            </p>
          ) : (
            <ul className="divide-y divide-outline-variant/15 rounded-md border border-outline-variant/15">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-on-surface">{r.displayName}</p>
                    <p className="text-xs text-on-surface-variant">
                      {r.status} · {r.id}
                    </p>
                  </div>
                  <Button variant="chevron" size="sm" asChild>
                    <Link
                      href={`/admin/legal-entities/${r.id}`}
                      className="inline-flex items-center gap-1"
                    >
                      Open
                      <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AdminPanelPage>
  );
}
