import { loadAdminSession } from "@/lib/admin-data.server";
import { safeReturnTo } from "@/lib/safe-return-to";
import Link from "next/link";
import { redirect } from "next/navigation";

export default function ShopAdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  return <ShopAdminLoginContent searchParams={searchParams} />;
}

async function ShopAdminLoginContent({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo?.trim());
  const loginHref = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

  const session = await loadAdminSession();
  if (session.status === "ok" && !params.error) {
    redirect(returnTo);
  }

  if (!params.error) {
    redirect(loginHref);
  }

  const errorMessage =
    params.error === "not_authorized"
      ? "Your account is signed in but does not have shop staff access."
      : params.error === "auth_failed"
        ? "Sign-in failed. Try again."
        : params.error === "missing_pending" || params.error === "missing_code"
          ? "Sign-in session expired. Try again."
          : `Sign-in failed (${params.error}). Try again.`;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold">Shop admin sign-in</h1>
      <p className="text-sm text-on-surface-variant">
        Staff sign-in uses the confidential <code>lax-shop-admin</code> OIDC client with silver MFA.
      </p>
      <p className="text-sm text-error" role="alert">
        {errorMessage}
      </p>
      <Link
        href={loginHref}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary"
      >
        Continue to sign in
      </Link>
    </main>
  );
}
