import { AdminFailedPage } from "@/components/admin-fetch-state";
import { OrderDetailView, orderPermissions } from "@/components/orders/order-detail-view";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { shouldLoadGuestErasure } from "@/server/domain/guest-erasure.vm";
import { orderNumber } from "@/server/domain/order-list.vm";
import type { AdminGuestErasureState, AdminOrderDetail } from "@auction/shop-contracts";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const result = await fetchAdminJson<AdminOrderDetail>(`orders/${orderId}`);
  return {
    title: `Order ${orderNumber(orderId, result.status === "ok" ? result.data.reference : null)}`,
  };
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
  const permissions = orderPermissions(capabilities);
  const detail = result.data;
  const erasureTarget = {
    canErase: permissions.eraseGuest,
    buyerIsGuest: detail.buyerIsGuest,
    guestCustomerId: detail.guestCustomerId,
  };
  // Only a guest's own order, for people who may erase; a failed read leaves the action out.
  const erasure = shouldLoadGuestErasure(erasureTarget)
    ? await fetchAdminJson<AdminGuestErasureState>(
        `guests/${erasureTarget.guestCustomerId}/erasure`,
      )
    : null;
  return (
    <OrderDetailView
      detail={detail}
      permissions={permissions}
      guestErasure={erasure?.status === "ok" ? erasure.data : null}
    />
  );
}
