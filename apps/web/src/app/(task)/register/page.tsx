import { ensureHostedAuthRedirect } from "@/lib/bff/hosted-auth-page.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Create account",
  "Register for a London Art Exchange account to bid, sell, and manage your collection.",
);

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; intent?: string; invite?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string" && value.length > 0) params.set(key, value);
  }
  await ensureHostedAuthRedirect({ route: "register", searchParams: params });
}
