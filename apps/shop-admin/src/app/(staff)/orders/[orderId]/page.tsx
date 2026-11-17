import { AdminFailedPage } from "@/components/admin-fetch-state";
import { OrderDetailView, orderPermissions } from "@/components/orders/order-detail-view";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { loadZohoFailedJobsHref } from "@/server/application/load-zoho-failed-jobs-href";
import { shouldLoadGuestErasure } from "@/server/domain/guest-erasure.vm";
import { orderNumber } from "@/server/domain/order-list.vm";
import { presentZohoMirror } from "@/server/domain/zoho-mirror.vm";
import type {
  AdminGuestErasureState,
  AdminOrderDetail,
  AdminPickAndPack,
  AdminZohoMirrorStatus,
} from "@auction/shop-contracts";
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
  // The Zoho badge is read beside the order, not after it; a failed read leaves the badge out.
  const [result, session, mirror] = await Promise.all([
    fetchAdminJson<AdminOrderDetail>(`orders/${orderId}`),
    loadAdminSession(),
    fetchAdminJson<AdminZohoMirrorStatus>(
      `zoho-mirror/status?entity=order&id=${encodeURIComponent(orderId)}`,
    ),
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
  // The pick list is extra to the order: a failed read leaves the panel out, not the page.
  const pack = detail.lines.some((line) => line.editionId)
    ? await fetchAdminJson<AdminPickAndPack>(`orders/${orderId}/pick-and-pack`)
    : null;
  const mirrorStatus = mirror.status === "ok" ? mirror.data : null;
  // Failed jobs is in Bid admin: linked only for people Bid shows the Zoho rows to (Q7, PRM-1),
  // and Bid is asked only on failure.
  const zohoMirror = presentZohoMirror(mirrorStatus, {
    failedJobsHref: mirrorStatus?.state === "failed" ? await loadZohoFailedJobsHref() : null,
  });
  return (
    <OrderDetailView
      detail={detail}
      pickAndPack={pack?.status === "ok" ? pack.data : null}
      permissions={permissions}
      guestErasure={erasure?.status === "ok" ? erasure.data : null}
      zohoMirror={zohoMirror}
    />
  );
}
