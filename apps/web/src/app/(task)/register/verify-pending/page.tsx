import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { buildBidIssuerHostedUrl } from "@/lib/bff/redirect-to-hosted-auth.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Verify your email",
  "Check your inbox to finish setting up your London Art Exchange account.",
);

export default async function VerifyPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email : undefined;
  const rawNext = typeof sp.next === "string" ? sp.next : "";
  const next = isSafeNextPath(rawNext) ? rawNext : undefined;
  redirect(
    buildBidIssuerHostedUrl("/resend-verification", {
      ...(email ? { email } : {}),
      ...(next ? { next } : {}),
    }),
  );
}
