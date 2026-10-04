import Link from "next/link";

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
  const returnTo = params.returnTo?.trim() || "/";
  const loginHref = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold">Shop admin sign-in</h1>
      <p className="text-sm text-on-surface-variant">
        Staff sign-in uses the confidential <code>lax-shop-admin</code> OIDC client with silver MFA.
      </p>
      {params.error ? (
        <p className="text-sm text-error" role="alert">
          Sign-in failed ({params.error}). Try again.
        </p>
      ) : null}
      <Link
        href={loginHref}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary"
      >
        Continue to sign in
      </Link>
    </main>
  );
}
