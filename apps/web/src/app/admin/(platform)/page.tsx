import {
  type AdminActivityRow,
  type AdminAttentionRow,
  AdminOperationsHomeView,
} from "@/components/admin/admin-operations-home-view";
import {
  getAdminLotList,
  getAdminMetricsLive,
  getAdminMetricsToday,
  getAdminPaymentList,
} from "@/lib/data/http/admin.server";
import { getAdminSubmissions } from "@/lib/data/http/submissions.server";

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
  let payments: Awaited<ReturnType<typeof getAdminPaymentList>> = [];
  let subs: Awaited<ReturnType<typeof getAdminSubmissions>> = [];
  let drafts: Awaited<ReturnType<typeof getAdminLotList>> = [];
  let recentLots: Awaited<ReturnType<typeof getAdminLotList>> = [];

  try {
    const [m, live, active, pay, underReview, draftRows, recent] = await Promise.all([
      getAdminMetricsToday(),
      getAdminMetricsLive(),
      getAdminLotList({ status: "active", limit: 20, sort: "endingAsc" }),
      getAdminPaymentList(),
      getAdminSubmissions({ status: "under_review", limit: 8 }),
      getAdminLotList({ status: "draft", limit: 30 }),
      getAdminLotList({ limit: 12, sort: "endingAsc" }),
    ]);
    metrics = m;
    bidsPerMinute = live.bidsPerMinute;
    activeLotIds = active.map((a) => a.id);
    payments = pay;
    subs = underReview;
    drafts = draftRows;
    recentLots = recent;
  } catch {
    /* overview still renders */
  }

  const now = Date.now();
  const hourMs = 60 * 60_000;
  const stalePay = payments.filter(
    (p) => p.status === "pending" && now - p.createdAt.getTime() > 48 * hourMs,
  );

  const attention: AdminAttentionRow[] = [];
  for (const s of subs.slice(0, 4)) {
    attention.push({
      id: `sub-${s.id}`,
      title: s.title ?? "Submission",
      hint: "Under review",
      href: `/admin/submissions/${s.id}`,
      ctaLabel: "Review",
    });
  }
  for (const p of stalePay.slice(0, 3)) {
    attention.push({
      id: `pay-${p.id}`,
      title: `Payment ${p.id.slice(0, 8)}…`,
      hint: "Pending > 48h",
      href: "/admin/payments",
      ctaLabel: "Open",
    });
  }
  for (const d of drafts.filter((l) => l.startTime.getTime() < now).slice(0, 3)) {
    attention.push({
      id: `draft-${d.id}`,
      title: d.title,
      hint: "Draft · start in the past",
      href: `/admin/lots/${d.id}`,
      ctaLabel: "Publish",
    });
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
