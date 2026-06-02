import { getServerSalesList } from "@/lib/data/http/sales.server";
import { saleAllowsStreamUrl } from "@/lib/sale-mode";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const activeSales = await getServerSalesList({ status: "active" });
    const hasLiveStream = activeSales.some(
      ({ sale }) =>
        saleAllowsStreamUrl(sale.deliveryMode) && sale.streamUrl && sale.streamUrl.trim() !== "",
    );
    return NextResponse.json({ active: hasLiveStream });
  } catch (error) {
    return NextResponse.json({ active: false, error: String(error) });
  }
}
export const dynamic = "force-dynamic";
