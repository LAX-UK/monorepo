import { getServerDataContainer } from "@/lib/data/container.server";
import { fetchServerAgreementPdf } from "@/lib/data/http/workspace-selling.server";
import { NextResponse } from "next/server";

/**
 * The consignment agreement as a PDF, through the app so the member's session and acting account
 * go with the request. The API decides who may read it; its refusal passes through.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const container = await getServerDataContainer();
  const user = await container.session.getCurrent().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await fetchServerAgreementPdf(id);
  if (!res.ok) {
    return NextResponse.json({ error: "agreement_unavailable" }, { status: res.status });
  }
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        res.headers.get("content-disposition") ?? 'attachment; filename="agreement.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
