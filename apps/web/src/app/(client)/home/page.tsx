import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveActiveOrganisation } from "@/lib/legal-entity/active-organisation.server";
import { accountHomePath } from "@/lib/navigation/account-home";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The active account's first page. Old `/dashboard` links and post-sign-in destinations land
 * here; the query string is kept because callers attach toast and analytics parameters to it.
 */
export default async function AccountHomePage({ searchParams }: PageProps) {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: CLIENT_ROUTES.home });
  const organisation = await resolveActiveOrganisation(user);
  const destination = accountHomePath(
    organisation
      ? { kind: "organisation", id: organisation.id, role: organisation.role }
      : { kind: "personal" },
  );
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, entry);
    }
  }
  const qs = query.toString();
  redirect(`${destination}${qs ? `?${qs}` : ""}`);
}
