import { MerchandiseProductEditor } from "@/components/merchandise/merchandise-product-editor.client";

export const metadata = { title: "New product" };

export default function ShopAdminNewMerchandisePage() {
  return <MerchandiseProductEditor detail={null} />;
}
