import { ActivateSetPasswordForm } from "@/components/auth/activate-set-password-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthRouteLoading } from "@/components/auth/auth-route-loading";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata = metadataForPrivate(
  "Set a password",
  "Choose a password for faster sign-in on London Art Exchange.",
);

export default async function ActivateSetPasswordPage() {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login?auth=required&next=/auth/activate/set-password");
  }
  if (user.suspended === true) {
    redirect("/account-suspended");
  }

  return (
    <Suspense fallback={<AuthRouteLoading />}>
      <main id="main-content">
        <AuthLayout
          chrome="task"
          title="Set a password"
          description="Optional — you can skip and continue into the auction."
        >
          <ActivateSetPasswordForm />
        </AuthLayout>
      </main>
    </Suspense>
  );
}
