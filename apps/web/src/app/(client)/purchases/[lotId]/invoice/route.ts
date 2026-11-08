import { getServerDataContainer } from "@/lib/data/container.server";
import { fetchPurchaseInvoicePdf } from "@/lib/purchases/purchase-invoice.server";
import { NextResponse } from "next/server";

/**
 * A won lot's invoice as a PDF, through the app so the member's session and acting account go
 * with the request. The API decides who may read it (only the member who pays); its refusal
 * passes through as "not available", the same for every reason.
 */
export async function GET(_request: Request, context: { params: Promise<{ lotId: string }> }) {
  const { lotId } = await context.params;
  const user = await (await getServerDataContainer()).session.getCurrent().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await fetchPurchaseInvoicePdf(lotId).catch(() => null);
  if (!res?.ok) {
    const status = res && res.status < 500 ? res.status : 503;
    return NextResponse.json({ error: "invoice_unavailable" }, { status });
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
