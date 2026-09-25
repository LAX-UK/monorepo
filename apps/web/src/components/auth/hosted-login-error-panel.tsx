"use client";

import { AuthLayout } from "@/components/auth/auth-layout";
import Link from "next/link";

const ERROR_COPY: Record<string, { title: string; description: string }> = {
  oidc_callback: {
    title: "Sign-in could not be completed",
    description: "Your login session expired or the response was invalid. Please try again.",
  },
  oidc_exchange: {
    title: "Sign-in could not be completed",
    description: "We could not finish signing you in with the identity provider. Please try again.",
  },
  reauth_subject_mismatch: {
    title: "You are still signed in",
    description:
      "That sign-in used a different account. Your original session was restored. Continue below or try again.",
  },
};

const RESTORED_COPY = {
  title: "You are still signed in",
  description:
    "Step-up sign-in did not complete, but your session is unchanged. Continue below or try again.",
};

export function HostedLoginErrorPanel({
  errorCode,
  next,
  restored,
  retryIntent,
}: {
  errorCode: string;
  next?: string | null;
  restored?: boolean;
  retryIntent?: string | null;
}) {
  const copy =
    restored === true
      ? RESTORED_COPY
      : (ERROR_COPY[errorCode] ?? {
          title: "Sign-in failed",
          description: "Something went wrong while signing you in. Please try again.",
        });
  const continueHref = next?.startsWith("/") ? next : "/dashboard";
  const retryParams = new URLSearchParams();
  if (next) retryParams.set("next", next);
  const reauth = retryIntent === "reauth" || errorCode === "reauth_subject_mismatch";
  if (reauth) retryParams.set("intent", "reauth");
  const retryQuery = retryParams.toString();
  const retryHref = retryQuery ? `/api/auth/login?${retryQuery}` : "/api/auth/login";
  const backHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <main id="main-content">
      <AuthLayout chrome="task" title={copy.title} description={copy.description}>
        <div className="flex flex-col gap-4">
          {restored || errorCode === "reauth_subject_mismatch" ? (
            <Link
              href={continueHref}
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Continue
            </Link>
          ) : null}
          <Link
            href={retryHref}
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {reauth ? "Try step-up again" : "Try again"}
          </Link>
          <Link href={backHref} className="text-center text-sm text-muted-foreground underline">
            Back to sign-in
          </Link>
        </div>
      </AuthLayout>
    </main>
  );
}
