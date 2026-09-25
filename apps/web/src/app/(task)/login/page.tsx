import { HostedLoginErrorPanel } from "@/components/auth/hosted-login-error-panel";
import { ensureHostedAuthRedirect } from "@/lib/bff/hosted-auth-page.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

const description = "Sign in to your LAX account to bid, track lots, and manage notifications.";

export const metadata: Metadata = metadataForPrivate("Sign in", description);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    switch?: string;
    verify_pending?: string;
    intent?: string;
    error?: string;
    restored?: string;
  }>;
}) {
  const sp = await searchParams;
  if (sp.error) {
    return (
      <HostedLoginErrorPanel
        errorCode={sp.error}
        next={sp.next ?? null}
        restored={sp.restored === "1"}
        retryIntent={sp.intent ?? null}
      />
    );
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string" && value.length > 0) params.set(key, value);
  }
  await ensureHostedAuthRedirect({ route: "login", searchParams: params });
}
