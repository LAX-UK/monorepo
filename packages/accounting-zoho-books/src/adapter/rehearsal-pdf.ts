/**
 * A one-page PDF that stands in for the provider's own while Books only rehearses. It carries the
 * LAX reference and the totals, and says in its title and first line that it is a rehearsal, not
 * a Books document; no names, no addresses. Built by hand (PDF 1.4, Helvetica, ASCII only) so the
 * adapter needs no PDF library.
 */
export function rehearsalPdf(lines: readonly string[]): Uint8Array {
  const text = ["REHEARSAL - not a Zoho Books document", ...lines]
    .map(
      (line, index) =>
        `BT /F1 ${index === 0 ? 14 : 11} Tf 56 ${780 - index * 22} Td (${pdfText(line)}) Tj ET`,
    )
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Title (Rehearsal - not a Zoho Books document) /Producer (LAX) >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

/** PDF string literal: only printable ASCII, with `\`, `(` and `)` escaped. */
function pdfText(value: string): string {
  return value.replace(/[^\x20-\x7e]/g, "?").replace(/[\\()]/g, (c) => `\\${c}`);
}
