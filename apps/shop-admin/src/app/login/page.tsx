import { loadAdminSession } from "@/lib/admin-data.server";
import { safeReturnTo } from "@/lib/safe-return-to";
import { shopAdminLoginErrorView } from "@/server/domain/login-error.vm";
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

  const view = shopAdminLoginErrorView(params.error);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
          LAX Shop Admin
        </p>
        <h1 className="text-2xl font-semibold">{view.title}</h1>
      </div>
      <p className="text-sm text-on-surface-variant" role="alert">
        {view.message}
      </p>
      <div className="flex flex-col gap-3">
        {view.showRetrySignIn ? (
          <Link
            href={loginHref}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary"
          >
            Try sign-in again
          </Link>
        ) : null}
        {view.showUseDifferentAccount ? (
          <form
            method="post"
            action={`/api/auth/switch-account?returnTo=${encodeURIComponent(returnTo)}`}
          >
            <button
              type="submit"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-outline px-4 text-sm font-medium"
            >
              Use a different account
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
