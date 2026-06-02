import { redirect } from "next/navigation";

/** Create flow: opens `/admin/venues?new=1` (sheet on the list). */
export default function NewAdminVenuePage() {
  redirect("/admin/venues?new=1");
}
