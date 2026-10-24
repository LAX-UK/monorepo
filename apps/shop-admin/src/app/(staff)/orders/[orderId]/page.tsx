import { AdminFailedPage } from "@/components/admin-fetch-state";
import { OrderDetailView, orderPermissions } from "@/components/orders/order-detail-view";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { orderNumber } from "@/server/domain/order-list.vm";
import type { AdminOrderDetail } from "@auction/shop-contracts";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ orderId: string }> }) {
  return { title: `Order ${orderNumber((await params).orderId)}` };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminOrderDetail>(`orders/${orderId}`),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return <AdminFailedPage title="Order" status={result.status} />;
  }
  const capabilities = session.status === "ok" ? session.data.capabilities : [];
  return <OrderDetailView detail={result.data} permissions={orderPermissions(capabilities)} />;
}
