import { paletteApiBase } from "@/components/layout/palette/api-base";
import type { PaletteSource } from "@/components/layout/palette/types";

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
    const res = await fetch(`${paletteApiBase()}/submissions?${qs.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data: SubmissionRow[] };
    return body.data.map((row) => ({
      id: `submission-${row.id}`,
      href: `/admin/submissions/${row.id}`,
      label: row.title,
      hint: row.status.replaceAll("_", " "),
    }));
  },
};
