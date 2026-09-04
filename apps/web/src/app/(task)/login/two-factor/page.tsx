import { getAuthIssuerBaseUrl } from "@/lib/auth-client";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

const description =
  "Enter the 6-digit code from your authenticator app to finish signing in to your LAX account.";

export const metadata: Metadata = metadataForPrivate("Two-step verification", description);

/** Legacy web-host route — MFA is hosted on the Identity issuer. */
export default async function LoginTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : "/dashboard";
  const next = isSafeNextPath(rawNext) ? rawNext : "/dashboard";
  const issuer = getAuthIssuerBaseUrl().replace(/\/$/, "");
  const target = new URL("/two-factor", issuer);
  if (next !== "/dashboard") target.searchParams.set("next", next);
  redirect(target.toString());
}
