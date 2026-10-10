import { loadAdminSession } from "@/lib/admin-data.server";
import { safeReturnTo } from "@/lib/safe-return-to";
import { shopAdminLoginErrorView } from "@/server/domain/login-error.vm";
import { SITE_SUPPORT_EMAIL } from "@auction/branding";
import { redirect } from "next/navigation";

const primaryButton =
  "inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary transition-opacity hover:opacity-90";
const secondaryButton =
  "inline-flex min-h-11 w-full items-center justify-center rounded-md border border-outline bg-surface px-4 text-sm font-medium text-on-surface transition-colors hover:bg-page-bg";

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
  const supportHref = `mailto:${SITE_SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `Shop admin sign-in problem (${view.code})`,
  )}`;

  return (
    <div className="flex min-h-screen flex-col bg-page-bg">
      <header className="border-b border-outline bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
          <span className="text-sm font-semibold tracking-[0.2em] uppercase">
            LAX <span className="font-normal text-on-surface-variant">Shop Admin</span>
          </span>
        </div>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-6 py-16">
        <section
          aria-labelledby="login-error-title"
          className="w-full max-w-md rounded-lg border border-outline bg-surface p-8 shadow-sm"
        >
          <h1 id="login-error-title" className="text-2xl font-semibold tracking-tight">
            {view.title}
          </h1>
          <div
            role="alert"
            className="mt-4 rounded-md border border-outline bg-warning-container p-4 text-sm leading-6"
          >
            {view.message}
          </div>
          <div className="mt-6 flex flex-col gap-3">
            {view.showRetrySignIn ? (
              <a href={loginHref} className={primaryButton}>
                Sign in again
              </a>
            ) : null}
            {view.showUseDifferentAccount ? (
              <form
                method="post"
                action={`/api/auth/switch-account?returnTo=${encodeURIComponent(returnTo)}`}
              >
                <button
                  type="submit"
                  className={view.showRetrySignIn ? secondaryButton : primaryButton}
                >
                  Use a different account
                </button>
              </form>
            ) : null}
          </div>
          <p className="mt-6 border-t border-outline pt-4 text-xs leading-5 text-on-surface-variant">
            Still stuck?{" "}
            <a href={supportHref} className="font-medium text-link underline underline-offset-2">
              Contact support
            </a>{" "}
            and quote reference <code className="font-mono">{view.code}</code>.
          </p>
        </section>
      </main>
    </div>
  );
}
