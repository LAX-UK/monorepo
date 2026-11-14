import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = "private, no-store";

/** One answer for every reason (signed out, not the shopper's, not issued, no copy, API down). */
function unavailable(): Response {
  return Response.json(
    { error: "document_unavailable" },
    { status: 404, headers: { "cache-control": NO_STORE } },
  );
}

/**
 * LAX's stored copy of the invoice Books issued for the shopper's order, passed on as the PDF it
 * is. Never cached; anything but that PDF is the same uncached 404, so nothing tells an onlooker
 * whether an order or a document exists.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string; documentId: string }> },
) {
  const { orderId, documentId } = await context.params;
  if (!UUID_PATTERN.test(orderId) || !UUID_PATTERN.test(documentId)) return unavailable();
  let response: Response | null = null;
  try {
    response = await shopCommerceRequest(
      `/commerce/orders/${encodeURIComponent(orderId)}/invoice-documents/${encodeURIComponent(documentId)}`,
      { headers: { accept: "application/pdf" } },
    );
  } catch {
    return unavailable();
  }
  if (response?.status !== 200 || response.headers.get("content-type") !== "application/pdf") {
    return unavailable();
  }
  const headers = new Headers({
    "content-type": "application/pdf",
    "cache-control": NO_STORE,
    "x-content-type-options": "nosniff",
  });
  const disposition = response.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);
  return new Response(response.body, { status: 200, headers });
}
