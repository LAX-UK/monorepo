import { openSignedAgreement } from "@/lib/admin/seller-proceeds/open-signed-agreement";

/** GET /admin/lots/:id/signed-agreement: the signed PDF on record, through a one-minute link. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return openSignedAgreement((await params).id);
}
