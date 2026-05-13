import { AdminImpersonateForm } from "@/components/admin/admin-impersonate-form";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";
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
    <AppScreen className="space-y-6">
      <PageHeader
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
              <Link
                href="/admin/legal-entities/stripe-connect-requirements"
                className="inline-flex items-center gap-1"
              >
                Stripe requirements
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        }
      />
      <Card className="border-outline-variant/15">
        <CardHeader>
          <CardTitle className="font-headline text-lg">Start session</CardTitle>
          <CardDescription>
            Choose an entity from search to start a support session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminImpersonateForm />
        </CardContent>
      </Card>
    </AppScreen>
  );
}
