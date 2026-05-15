import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { redirect } from "next/navigation";

export default async function TeamRedirectPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/team",
  });
  const { acting } = await resolveActingContext(user.role, user.staffRole ?? null);
  if (!acting || acting.kind === "individual") {
    redirect("/dashboard/organisations");
  }
  redirect(`/dashboard/organisations/${acting.id}/members`);
}
