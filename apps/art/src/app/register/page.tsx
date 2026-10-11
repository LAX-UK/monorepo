import { artIdentityBaseUrl } from "@/lib/art-identity.server";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artIdentityAuthStartHref } from "@/lib/auth/art-auth-start";
import { redirect } from "next/navigation";

export const metadata = artPrivatePageTitle("Create account");

type ArtRegisterPageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function ArtRegisterPage({ searchParams }: ArtRegisterPageProps) {
  const { returnTo } = await searchParams;
  redirect(artIdentityAuthStartHref(artIdentityBaseUrl(), "register", returnTo));
}
