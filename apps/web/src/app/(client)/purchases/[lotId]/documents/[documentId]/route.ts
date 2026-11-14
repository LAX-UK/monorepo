import { getServerDataContainer } from "@/lib/data/container.server";
import { fetchPurchaseDocumentPdf } from "@/lib/purchases/purchase-invoice.server";
import { NextResponse } from "next/server";

/** The one answer for anything but the PDF: never cached, and the same whatever the reason. */
function unavailable() {
  return NextResponse.json(
    { error: "document_unavailable" },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * LAX's stored copy of a Books invoice, through the app so the member's session and acting
 * account go with the request. The API decides who may read it (only the member who pays). Every
 * answer other than the PDF (signed out, not the payer, no such lot or document, the API down) is
 * one 404 "not available", so the route never says why, and no answer is ever cached.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ lotId: string; documentId: string }> },
) {
  const { lotId, documentId } = await context.params;
  const user = await (await getServerDataContainer()).session.getCurrent().catch(() => null);
  if (!user) return unavailable();
  const res = await fetchPurchaseDocumentPdf(lotId, documentId).catch(() => null);
  if (res?.status !== 200 || !res.body) return unavailable();
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition":
        res.headers.get("content-disposition") ?? 'attachment; filename="document.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
