import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveActiveOrganisation } from "@/lib/legal-entity/active-organisation.server";
import { accountHomePath } from "@/lib/navigation/account-home";
import { resolveClientRequestPath } from "@/lib/navigation/client-request-path.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A personal account has no Home and starts at My bids. The redirect is decided here, outside
 * Home's loading boundary, so it is a real redirect before anything is sent: a redirect from
 * inside the boundary would stream an empty page and leave the move to the browser's script.
 * The query string is kept because callers attach toast and analytics parameters.
 */
export default async function HomeLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: CLIENT_ROUTES.home });
  if (!(await resolveActiveOrganisation(user))) {
    const requested = await resolveClientRequestPath();
    const query = requested.includes("?") ? requested.slice(requested.indexOf("?")) : "";
    redirect(`${accountHomePath({ kind: "personal" })}${query}`);
  }
  return children;
}
