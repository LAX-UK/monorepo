import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ThirdPartySalesList } from "@/components/sales/third-party-sales-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import type { AdminThirdPartySaleList } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Third-party sales" };

export default async function ThirdPartySalesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminThirdPartySaleList>(adminListPath("third-party-sales", { cursor })),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Third-party sales" status={result.status} />;
  }
  const capabilities = session.status === "ok" ? session.data.capabilities : [];

  return (
    <ThirdPartySalesList
      page={result.data}
      cursor={cursor ?? null}
      canRecord={capabilities.includes("third_party_sale.write")}
      canApproveFees={capabilities.includes("fee.approve")}
    />
  );
}
