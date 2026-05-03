import {
  type AdminActivityRow,
  type AdminAttentionRow,
  AdminOperationsHomeView,
} from "@/components/admin/admin-operations-home-view";
import {
  getAdminAttentionFeed,
  getAdminLotList,
  getAdminMetricsLive,
  getAdminMetricsToday,
} from "@/lib/data/http/admin.server";

export default async function AdminHomePage() {
  let metrics = {
    liveLots: 0,
    endingWithinHour: 0,
    draftLots: 0,
    pendingSubmissions: 0,
    stalePendingPayments: 0,
    revenueToday: "0",
  };
  let bidsPerMinute = 0;
  let activeLotIds: string[] = [];
  let attention: AdminAttentionRow[] = [];
  let recentLots: Awaited<ReturnType<typeof getAdminLotList>> = [];

  try {
    const [m, live, active, feed, recent] = await Promise.all([
      getAdminMetricsToday(),
      getAdminMetricsLive(),
      getAdminLotList({ status: "active", limit: 20, sort: "endingAsc" }),
      getAdminAttentionFeed(),
      getAdminLotList({ limit: 12, sort: "endingAsc" }),
    ]);
    metrics = m;
    bidsPerMinute = live.bidsPerMinute;
    activeLotIds = active.map((a) => a.id);
    attention = feed.map((item) => ({
      id: item.id,
      title: item.title,
      hint: item.hint,
      href: item.href,
      ctaLabel: item.ctaLabel ?? "Open",
    }));
    recentLots = recent;
  } catch {
    /* overview still renders */
  }

  const activity: AdminActivityRow[] = recentLots.slice(0, 10).map((l) => ({
    id: l.id,
    title: l.title,
    meta: `${l.status} · ends ${l.endTime.toISOString().slice(0, 16)}`,
    href: `/admin/lots/${l.id}`,
  }));

  return (
    <AdminOperationsHomeView
      metrics={metrics}
      bidsPerMinute={bidsPerMinute}
      activeLotIds={activeLotIds}
      attention={attention}
      activity={activity}
    />
  );
}
