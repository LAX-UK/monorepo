import type { AttentionDomain } from "@/lib/admin/admin-home-types";
import { isDashboardWidgetVisible } from "@/lib/admin/dashboard-widgets.vm";
import type { DashboardLoadContext } from "@/lib/admin/dashboard/dashboard-load-context";
import { recordDashboardSliceFailure } from "@/lib/admin/dashboard/dashboard-telemetry";
import { type DashboardSlice, unavailableSlice } from "@/lib/admin/dashboard/slice-state";
import type { AdminWorkItemsResponse } from "@/lib/data/http/admin-work-items.schema";

export type WorkInboxData = AdminWorkItemsResponse;

export type WorkInboxSlice = DashboardSlice<WorkInboxData>;

export type WorkInboxLoadResult = {
  slice: WorkInboxSlice;
  loadWarning: string | null;
};

function domainAllowed(domain: string, queueDomains: readonly AttentionDomain[]): boolean {
  const map: Record<string, AttentionDomain> = {
    finance: "Finance",
    compliance: "Compliance",
    catalogue: "Catalog",
    saleroom: "Operations",
    fulfilment: "Operations",
    clients: "People",
  };
  const attentionDomain = map[domain];
  if (!attentionDomain) return true;
  return queueDomains.includes(attentionDomain);
}

export async function loadWorkInboxSlice(
  ctx: DashboardLoadContext,
  options: {
    actorUserId?: string;
    assignment?: "mine" | "unassigned" | "all";
  } = {},
): Promise<WorkInboxLoadResult> {
  if (!isDashboardWidgetVisible(ctx.widgets, "my-queue")) {
    return {
      slice: {
        status: "empty",
        data: {
          items: [],
          nextCursor: null,
          counts: {
            total: 0,
            urgent: 0,
            byDomain: {
              finance: 0,
              compliance: 0,
              catalogue: 0,
              saleroom: 0,
              fulfilment: 0,
              clients: 0,
            },
          },
        },
        message: "Work inbox hidden by layout preferences.",
      },
      loadWarning: null,
    };
  }

  try {
    const assignment = options.assignment ?? "all";
    const data = await ctx.sources.getWorkItems({ limit: 50, assignment });
    const filteredItems = data.items.filter((item) =>
      domainAllowed(item.domain, ctx.profile.queueDomains),
    );
    const byDomain = {
      finance: 0,
      compliance: 0,
      catalogue: 0,
      saleroom: 0,
      fulfilment: 0,
      clients: 0,
    };
    for (const item of filteredItems) {
      byDomain[item.domain] += 1;
    }
    const payload: WorkInboxData = {
      ...data,
      items: filteredItems,
      counts: {
        ...data.counts,
        total: filteredItems.length,
        urgent: filteredItems.filter(
          (item) => item.severity === "critical" || item.severity === "high",
        ).length,
        byDomain,
      },
    };

    if (payload.items.length === 0) {
      return {
        slice: {
          status: "empty",
          data: payload,
          message: ctx.profile.emptyStateNextStep,
        },
        loadWarning: null,
      };
    }

    return { slice: { status: "ready", data: payload }, loadWarning: null };
  } catch {
    recordDashboardSliceFailure({
      slice: "work-inbox",
      profileId: ctx.profileId,
      retryable: true,
    });
    return {
      slice: unavailableSlice<WorkInboxData>(
        "Could not load your work inbox. Retry by refreshing the page.",
      ),
      loadWarning: "Could not load work inbox.",
    };
  }
}
