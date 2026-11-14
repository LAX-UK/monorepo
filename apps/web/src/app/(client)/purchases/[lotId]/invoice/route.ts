import { getServerDataContainer } from "@/lib/data/container.server";
import { recordRefusalStatus } from "@/lib/http/record-refusal-status";
import { fetchPurchaseInvoicePdf } from "@/lib/purchases/purchase-invoice.server";
import { NextResponse } from "next/server";

/**
 * A won lot's invoice as a PDF, through the app so the member's session and acting account go
 * with the request. The API decides who may read it (only the member who pays); its refusal
 * passes through as "not available", the same for every reason, and a refused one reads as not
 * found so someone else's invoice is never confirmed.
 */
export async function GET(_request: Request, context: { params: Promise<{ lotId: string }> }) {
  const { lotId } = await context.params;
  const user = await (await getServerDataContainer()).session.getCurrent().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await fetchPurchaseInvoicePdf(lotId).catch(() => null);
  if (!res?.ok) {
    return NextResponse.json(
      { error: "invoice_unavailable" },
      { status: recordRefusalStatus(res?.status ?? null) },
    );
  }
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition":
        res.headers.get("content-disposition") ?? 'attachment; filename="invoice.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
