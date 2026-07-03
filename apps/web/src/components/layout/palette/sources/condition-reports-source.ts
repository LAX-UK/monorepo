import { paletteRecordHint } from "@/components/layout/palette/palette-item-presenter";
import type { PaletteSource } from "@/components/layout/palette/types";
import { paletteJsonFetch } from "@/lib/data/http/palette-search.client";

const LIMIT = 5;

type ConditionReportRow = {
  id: string;
  lotId: string;
  lotTitle: string | null;
  status: string;
};

export const conditionReportsPaletteSource: PaletteSource = {
  id: "condition-reports",
  heading: "Condition reports",
  enabled: true,
  async search(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const qs = new URLSearchParams({
      status: "open",
      limit: "25",
      offset: "0",
    });
    const body = await paletteJsonFetch<{
      data: { items: ConditionReportRow[] };
    }>("/admin/condition-report-requests", qs);
    if (!body) return [];
    const needle = q.toLowerCase();
    return body.data.items
      .filter(
        (row) =>
          row.id.toLowerCase().includes(needle) ||
          row.lotId.toLowerCase().includes(needle) ||
          (row.lotTitle?.toLowerCase().includes(needle) ?? false) ||
          row.status.toLowerCase().includes(needle),
      )
      .slice(0, LIMIT)
      .map((row) => ({
        id: `condition-report-${row.id}`,
        href: "/admin/condition-reports?lens=open",
        label: row.lotTitle ?? `Lot ${row.lotId.slice(0, 8)}…`,
        hint: paletteRecordHint("record", row.status) ?? "Condition report",
        kind: "record" as const,
      }));
  },
};
