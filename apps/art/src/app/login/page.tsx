import { artIdentityBaseUrl } from "@/lib/art-identity.server";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artIdentityAuthStartHref } from "@/lib/auth/art-auth-start";
import { redirect } from "next/navigation";

export const metadata = artPrivatePageTitle("Sign in");

type ArtLoginPageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function ArtLoginPage({ searchParams }: ArtLoginPageProps) {
  const { returnTo } = await searchParams;
  redirect(artIdentityAuthStartHref(artIdentityBaseUrl(), "login", returnTo));
}
