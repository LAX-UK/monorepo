import { AdminLegalEntityOpenForm } from "@/components/admin/admin-legal-entity-open-form";
import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { LegalEntityStripeRequirementsSection } from "@/components/admin/legal-entity-stripe-requirements-section";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AdminLegalEntitiesLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; stripe?: string }>;
}) {
  const user = await requireAuthenticatedUser({
    shell: "staff",
    loginNext: "/admin/legal-entities",
  });
  if (!canAccessPlatformAdminRoutes(user.role as UserRole, user.staffRole ?? null)) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const showStripe = sp.stripe === "1";

  return (
    <AdminPanelPage
      title="Legal entities"
      description="Search by name to open an organisation or selling entity, review status, and run verification lifecycle transitions."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="ctaLink" asChild>
            <Link href="/admin/impersonation" className="inline-flex items-center gap-1">
              Impersonation
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button variant="ctaLink" asChild>
            <Link href="/admin/legal-entities?stripe=1" className="inline-flex items-center gap-1">
              Stripe requirements
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      }
    >
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {showStripe ? <LegalEntityStripeRequirementsSection /> : null}
      <Surface variant="card" className="border-border-hairline">
        <div className="space-y-1">
          <h3 className="font-headline text-lg font-semibold text-on-surface">Open entity</h3>
          <p className="font-body text-sm text-on-surface-variant">
            Pick an entity from search results to open its admin detail page.
          </p>
        </div>
        <div>
          <AdminLegalEntityOpenForm />
        </div>
      </Surface>
    </AdminPanelPage>
  );
}
