import { paletteApiBase } from "@/components/layout/palette/api-base";
import { paletteRecordHint } from "@/components/layout/palette/palette-item-presenter";
import type { PaletteSource } from "@/components/layout/palette/types";

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
    const res = await fetch(
      `${paletteApiBase()}/admin/condition-report-requests?${qs.toString()}`,
      {
        credentials: "include",
      },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as {
      data: { items: ConditionReportRow[] };
    };
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
