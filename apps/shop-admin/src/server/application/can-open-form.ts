import { redirect } from "next/navigation";
import { loadAdminSession } from "./load-admin-data";

/**
 * Whether the signed-in person holds `capability`, for pages that only make sense to someone who
 * can save them (a blank form). Signed-out people go to sign-in; shop-api refuses the save too.
 */
export async function canOpenForm(capability: string): Promise<boolean> {
  const session = await loadAdminSession();
  if (session.status === "unauthorized") redirect("/login");
  return session.status === "ok" && session.data.capabilities.includes(capability);
}
