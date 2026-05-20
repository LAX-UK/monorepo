import { AdminImpersonateForm } from "@/components/admin/admin-impersonate-form";
import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AdminImpersonationPage() {
  const user = await requireAuthenticatedUser({
    shell: "staff",
    loginNext: "/admin/impersonation",
  });
  if (!canAccessPlatformAdminRoutes(user.role as UserRole, user.staffRole ?? null)) {
    redirect("/admin");
  }

  return (
    <AdminPanelPage
      title="Impersonate organisation"
      description="Search for a legal entity you are not a member of. A four-hour support session starts; owners and admins are emailed automatically."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="ctaLink" asChild>
            <Link href="/admin/legal-entities" className="inline-flex items-center gap-1">
              Legal entities
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
      <Surface variant="section" padding="md" className="space-y-4 border-border-hairline">
        <div className="space-y-1">
          <h3 className="font-headline text-lg font-semibold text-on-surface">Start session</h3>
          <p className="font-body text-sm text-on-surface-variant">
            Choose an entity from search to start a support session.
          </p>
        </div>
        <AdminImpersonateForm />
      </Surface>
    </AdminPanelPage>
  );
}
