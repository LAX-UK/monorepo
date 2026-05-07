import { openAdminLegalEntityAction } from "@/lib/admin/legal-entity-lifecycle.actions";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { PageHeader } from "@auction/ui/components/page-header";
import { canAccessPlatformAdminRoutes, type UserRole } from "@auction/types";
import { redirect } from "next/navigation";

export default async function AdminLegalEntitiesLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireAuthenticatedUser({
    shell: "staff",
    loginNext: "/admin/legal-entities",
  });
  if (!canAccessPlatformAdminRoutes(user.role as UserRole)) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  return (
    <div className="screen mx-auto w-full max-w-lg space-y-6">
      <PageHeader
        title="Legal entities"
        description="Open a selling or buying organisation by UUID to review status and run verification lifecycle transitions."
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
        <form action={openAdminLegalEntityAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="legalEntityId">Legal entity UUID</Label>
            <Input
              id="legalEntityId"
              name="legalEntityId"
              placeholder="00000000-0000-4000-8000-000000000000"
              autoComplete="off"
              required
            />
          </div>
          <Button type="submit">Open entity</Button>
        </form>
      </section>
    </div>
  );
}
