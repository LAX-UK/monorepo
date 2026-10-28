import { OrganisationHome } from "@/components/organisation-home/organisation-home";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveActiveOrganisation } from "@/lib/legal-entity/active-organisation.server";
import { accountHomePath } from "@/lib/navigation/account-home";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { loadOrganisationHome } from "@/lib/organisation-home/load-organisation-home.server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Home" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The active account's first page. An organisation has a Home of its own; a personal account has
 * none and starts at My bids. Old `/dashboard` links and post-sign-in destinations land here; the
 * query string is kept on the redirect because callers attach toast and analytics parameters.
 */
export default async function AccountHomePage({ searchParams }: PageProps) {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: CLIENT_ROUTES.home });
  const organisation = await resolveActiveOrganisation(user);
  if (organisation) {
    return <OrganisationHome home={await loadOrganisationHome(user, organisation)} />;
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, entry);
    }
  }
  const qs = query.toString();
  const destination = accountHomePath({ kind: "personal" });
  redirect(`${destination}${qs ? `?${qs}` : ""}`);
}
