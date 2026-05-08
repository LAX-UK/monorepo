import { AdminImpersonateForm } from "@/components/admin/admin-impersonate-form";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import { PageHeader } from "@auction/ui/components/page-header";
import { redirect } from "next/navigation";

export default async function AdminImpersonationPage() {
  const user = await requireAuthenticatedUser({
    shell: "staff",
    loginNext: "/admin/impersonation",
  });
  if (!canAccessPlatformAdminRoutes(user.role as UserRole)) {
    redirect("/admin");
  }

  return (
    <div className="screen mx-auto w-full max-w-lg space-y-6">
      <PageHeader
        title="Impersonate organisation"
        description="Enter a legal entity UUID for an organisation you are not a member of. A 4-hour support session starts; owners and admins are emailed automatically."
      />
      <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
        <AdminImpersonateForm />
      </section>
    </div>
  );
}
