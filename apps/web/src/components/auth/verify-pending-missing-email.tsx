import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import Link from "next/link";

/** Shown when verify-pending is opened without an email address on file. */
export function VerifyPendingMissingEmail() {
  return (
    <main id="main-content">
      <AuthLayout
        chrome="task"
        title="Check your inbox"
        description="We need your email address to show verification instructions."
      >
        <div className="flex flex-col gap-8">
          <p className="font-body text-sm text-on-surface-variant">
            If you just signed up, return to registration and try again. Otherwise sign in — we may
            already have sent you a verification link.
          </p>
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 py-3 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary"
          >
            Sign up again
          </Link>
          <AuthFooterLink
            prefix="Already registered?"
            linkText="Sign in"
            href="/login?verify_pending=1"
          />
        </div>
      </AuthLayout>
    </main>
  );
}
