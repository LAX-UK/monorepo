import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import { MerchandiseProductEditor } from "@/components/merchandise/merchandise-product-editor.client";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { MerchandiseProductDetail } from "@auction/shop-contracts";
import { PageHeader } from "@auction/ui";
import { notFound, redirect } from "next/navigation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Edit product" };

export default async function ShopAdminMerchandiseProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const result = await fetchAdminJson<MerchandiseProductDetail>(`merchandise/products/${id}`);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") return <AdminFailedPage title="Product" status={result.status} />;
  const product = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs
            list={{ label: "Products", href: "/merchandise" }}
            current={product.title}
          />
        }
        title={product.title}
        description={`/${product.slug}`}
      />
      <MerchandiseProductEditor key={product.productId} detail={product} />
    </div>
  );
}
