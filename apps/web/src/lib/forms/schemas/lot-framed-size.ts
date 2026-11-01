/** A framed size is typed in centimetres, to one decimal place; the API holds it as numbers. */
const FRAMED_CM_MAX = 10_000;

export type FramedCmReading = { ok: true; value: number | null } | { ok: false; message: string };

/** Reads one framed side from its text field: empty means "not given". */
export function readFramedCm(text: string | undefined): FramedCmReading {
  const trimmed = (text ?? "").trim().replace(",", ".");
  if (trimmed === "") return { ok: true, value: null };
  if (!/^\d+(\.\d)?$/.test(trimmed)) {
    return { ok: false, message: "Enter a size in centimetres, like 62.5" };
  }
  const value = Number(trimmed);
  if (value <= 0) return { ok: false, message: "Enter a size above zero" };
  if (value > FRAMED_CM_MAX) return { ok: false, message: "That size is too large" };
  return { ok: true, value };
}

export type FramedSizeIssue = { field: "framedWidthCm" | "framedHeightCm"; message: string };

/** What is wrong with the framed width and height as typed: a bad number, or only one of the pair. */
export function framedSizeIssues(
  width: string | undefined,
  height: string | undefined,
): FramedSizeIssue[] {
  const w = readFramedCm(width);
  const h = readFramedCm(height);
  const issues: FramedSizeIssue[] = [];
  if (!w.ok) issues.push({ field: "framedWidthCm", message: w.message });
  if (!h.ok) issues.push({ field: "framedHeightCm", message: h.message });
  if (w.ok && h.ok && (w.value === null) !== (h.value === null)) {
    issues.push({
      field: w.value === null ? "framedWidthCm" : "framedHeightCm",
      message: "Give both the framed width and the framed height",
    });
  }
  return issues;
}
