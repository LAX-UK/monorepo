import { redirect } from "next/navigation";

/** Deep-link compatibility — impersonation starts from legal entity list/detail. */
export default function AdminImpersonationRedirectPage() {
  redirect("/admin/legal-entities");
}
