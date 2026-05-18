/** Strip currency symbols and grouping separators; keep digits and one decimal point. */
export function normalizeCurrencyInput(raw: string): string {
  const trimmed = raw.trim().replace(/\u00a0/g, " ");
  if (!trimmed) return "";

  let work = trimmed;
  const hasDot = work.includes(".");
  const hasComma = work.includes(",");
  if (hasDot && hasComma) {
    work = work.replace(/,/g, "");
  } else if (hasComma && !hasDot && /,\d{3}(?:\D|$)/.test(work)) {
    work = work.replace(/,/g, "");
  }

  let out = "";
  let seenDot = false;
  for (const ch of work) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
      continue;
    }
    if (ch === "." && !seenDot) {
      seenDot = true;
      out += ch;
      continue;
    }
    if (ch === "," && !seenDot) {
      seenDot = true;
      out += ".";
    }
  }

  if (out.endsWith(".")) out = out.slice(0, -1);
  return out;
}
