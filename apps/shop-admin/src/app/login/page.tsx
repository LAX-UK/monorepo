import Link from "next/link";

const identityLoginUrl =
  process.env.SHOP_ADMIN_IDENTITY_LOGIN_URL ?? "http://localhost:3010/auth/login";

export default function ShopAdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold">Shop admin sign-in</h1>
      <p className="text-sm text-on-surface-variant">
        Staff sign-in uses the confidential <code>lax-shop-admin</code> OIDC client with silver MFA.
        This stub redirects to the configured Identity login URL.
      </p>
      <Link
        href={identityLoginUrl}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary"
      >
        Continue to sign in
      </Link>
    </main>
  );
}
