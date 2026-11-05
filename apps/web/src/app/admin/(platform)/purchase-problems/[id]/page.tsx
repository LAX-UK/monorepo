import { PurchaseProblemView } from "@/components/admin/purchase-problems/purchase-problem-view";
import { loadAdminPurchaseProblemPage } from "@/lib/admin/purchase-problems/load-purchase-problem-page";
import { purchaseProblemLinks } from "@/lib/admin/purchase-problems/purchase-problem-access";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { PURCHASE_PROBLEMS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { UserRole } from "@auction/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = metadataForPrivate(
  "Purchase problem",
  "One purchase problem: what the buyer reported, the purchase, who owns it, its notes and its history.",
);

export default async function AdminPurchaseProblemPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAdminCapability(
    PURCHASE_PROBLEMS_ACCESS,
    `/admin/purchase-problems/${id}`,
  );
  const page = await loadAdminPurchaseProblemPage(decodeURIComponent(id));
  if (page.kind === "not_found") notFound();
  if (page.kind !== "ready") {
    throw new Error(
      page.kind === "forbidden"
        ? "forbidden"
        : "Purchase problem unavailable. Try again in a moment.",
    );
  }
  return (
    <PurchaseProblemView
      problem={page.problem}
      assignees={page.assignees}
      viewerId={user.id}
      links={purchaseProblemLinks({ role: user.role as UserRole, staffRoles: user.staffRoles })}
    />
  );
}
