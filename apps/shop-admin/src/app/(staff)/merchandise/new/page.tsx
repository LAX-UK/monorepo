import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { MerchandiseProductEditor } from "@/components/merchandise/merchandise-product-editor.client";
import { PageHeader } from "@auction/ui";

export const metadata = { title: "New product" };

export default function ShopAdminNewMerchandisePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs
            list={{ label: "Products", href: "/merchandise" }}
            current="New product"
          />
        }
        title="New product"
        description="Add the product and its first variant. It goes on sale as soon as it is created and has stock."
      />
      <MerchandiseProductEditor detail={null} />
    </div>
  );
}
