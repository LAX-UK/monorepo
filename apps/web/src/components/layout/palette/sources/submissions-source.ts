import { paletteRecordHint } from "@/components/layout/palette/palette-item-presenter";
import type { PaletteSource } from "@/components/layout/palette/types";
import { paletteJsonFetch } from "@/lib/data/http/palette-search.client";

const LIMIT = 5;

type SubmissionRow = {
  id: string;
  title: string;
  status: string;
};

export const submissionsPaletteSource: PaletteSource = {
  id: "submissions",
  heading: "Submissions",
  enabled: true,
  async search(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const qs = new URLSearchParams({ q, limit: String(LIMIT), offset: "0" });
    const body = await paletteJsonFetch<{ data: SubmissionRow[] }>("/submissions", qs);
    if (!body) return [];
    return body.data.map((row) => ({
      id: `submission-${row.id}`,
      href: `/admin/submissions/${row.id}`,
      label: row.title,
      hint: paletteRecordHint("record", row.status) ?? "Submission",
      kind: "record" as const,
    }));
  },
};
