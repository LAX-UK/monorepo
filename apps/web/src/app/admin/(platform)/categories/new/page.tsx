import { redirect } from "next/navigation";

/** Create flow: opens `/admin/categories?new=1` (sheet on the list). */
export default function NewAdminCategoryPage() {
  redirect("/admin/categories?new=1");
}
